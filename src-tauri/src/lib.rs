mod icons;
mod inject {
    pub const SCRIPT: &str = include_str!("inject.js");
}
mod settings;
mod spellcheck;

use std::sync::Mutex;

use regex::Regex;
use serde::Serialize;
use settings::Settings;
use tauri::{
    image::Image,
    menu::{
        AboutMetadataBuilder, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder,
    },
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    webview::{NewWindowResponse, WebviewBuilder},
    window::WindowBuilder,
    AppHandle, Emitter, Listener, LogicalPosition, LogicalSize, Manager, State, WebviewUrl, Window,
    WindowEvent,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const BAR_H: f64 = 48.0;
const LOGIN: &str = "https://notion.so/login";
// Mirrors src/cohesion.ts USER_AGENT so Notion serves the Chromium code path.
const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct Tab {
    label: String,
    title: String,
    zoom: f64,
}

#[derive(Default)]
struct Tabs {
    list: Vec<Tab>,
    active: usize,
    counter: usize,
}

#[derive(Default)]
struct Misc {
    quitting: bool,
    menu_revealed: bool,
    unread: u32,
}

#[derive(Clone, Serialize)]
struct Release {
    version: String,
    date: String,
    items: Vec<String>,
}

struct Ctx {
    settings: Settings,
    tabs: Mutex<Tabs>,
    tray: Mutex<Option<TrayIcon>>,
    misc: Mutex<Misc>,
    releases: Vec<Release>,
}

#[derive(Serialize)]
struct TabInfo {
    title: String,
    index: usize,
    active: bool,
}

#[derive(Serialize)]
struct ReleaseData {
    version: String,
    date: String,
    items: Vec<String>,
    #[serde(rename = "allReleases")]
    all_releases: Vec<Release>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn clean(title: &str) -> String {
    let t = title.trim();
    t.strip_suffix("Notion")
        .map(|s| s.trim_end_matches(['–', '—', '|', ' ']).to_string())
        .unwrap_or_else(|| t.to_string())
}

fn main_window(app: &AppHandle) -> Window {
    app.get_window("main").expect("main window missing")
}

fn content_size(w: &Window) -> (f64, f64) {
    let sf = w.scale_factor().unwrap_or(1.0);
    let s = w.inner_size().unwrap_or_default();
    (s.width as f64 / sf, s.height as f64 / sf)
}

fn webview_by_label(app: &AppHandle, label: &str) -> Option<tauri::Webview> {
    main_window(app)
        .webviews()
        .into_iter()
        .find(|w| w.label() == label)
}

/// notion://www.notion.so/... -> https://www.notion.so/... (mirrors src/index.ts).
fn extract_url<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter()
        .find(|a| a.starts_with("notion://www.notion.so/"))
        .map(|a| a.replacen("notion://", "https://", 1))
}

fn current_spell(ctx: &Ctx) -> (bool, Vec<String>) {
    let forced_off = std::env::args().any(|a| a == "--disable-spellcheck");
    let enabled = !forced_off && ctx.settings.get_bool("spellcheck", "enabled", true);
    let languages = ctx.settings.get_strings("spellcheck", "languages");
    (enabled, languages)
}

// ---------------------------------------------------------------------------
// Layout: position/size every child webview; show only the active tab.
// ---------------------------------------------------------------------------

fn apply_layout(app: &AppHandle) {
    let w = main_window(app);
    let (cw, ch) = content_size(&w);
    let ctx = app.state::<Ctx>();
    let g = ctx.tabs.lock().unwrap();
    let bar = if g.list.len() > 1 { BAR_H } else { 0.0 };
    let active_label = g.list.get(g.active).map(|t| t.label.clone());
    drop(g);

    for wv in w.webviews() {
        match wv.label() {
            "tabbar" => {
                let _ = wv.set_position(LogicalPosition::new(0.0, 0.0));
                let _ = wv.set_size(LogicalSize::new(cw, bar));
            }
            "whatsnew" => {
                let _ = wv.set_position(LogicalPosition::new(0.0, 0.0));
                let _ = wv.set_size(LogicalSize::new(cw, ch));
                let _ = wv.show();
            }
            label => {
                let _ = wv.set_position(LogicalPosition::new(0.0, bar));
                let _ = wv.set_size(LogicalSize::new(cw, ch - bar));
                if Some(label.to_string()) == active_label {
                    let _ = wv.show();
                } else {
                    let _ = wv.hide();
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

fn add_tab(app: &AppHandle, url: String) {
    let w = main_window(app);
    let (cw, ch) = content_size(&w);

    let label = {
        let ctx = app.state::<Ctx>();
        let mut g = ctx.tabs.lock().unwrap();
        g.counter += 1;
        format!("tab-{}", g.counter)
    };

    let title_app = app.clone();
    let title_label = label.clone();
    let neww_app = app.clone();

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(url.parse().unwrap()))
        .user_agent(USER_AGENT)
        .initialization_script(inject::SCRIPT)
        .on_document_title_changed(move |wv, title| {
            let ctx = title_app.state::<Ctx>();
            let (is_active, cleaned) = {
                let mut g = ctx.tabs.lock().unwrap();
                let cleaned = clean(&title);
                if let Some(t) = g.list.iter_mut().find(|t| t.label == title_label) {
                    t.title = cleaned.clone();
                }
                let active = g
                    .list
                    .get(g.active)
                    .map(|t| t.label == title_label)
                    .unwrap_or(false);
                (active, cleaned)
            };
            if is_active {
                let _ = wv.window().set_title(&cleaned);
                let unread = icons::unread_messages(&cleaned);
                update_tray(&title_app, unread);
            }
            let _ = title_app.emit("update-tabs", ());
        })
        .on_new_window(move |target, _| {
            let _ = neww_app.emit("open-tab", target.to_string());
            NewWindowResponse::Deny
        });

    let child = w.add_child(
        builder,
        LogicalPosition::new(0.0, BAR_H),
        LogicalSize::new(cw, ch - BAR_H),
    );

    if let Ok(wv) = &child {
        let ctx = app.state::<Ctx>();
        let (enabled, languages) = current_spell(&ctx);
        spellcheck::apply(wv, enabled, languages);
    }

    {
        let ctx = app.state::<Ctx>();
        let mut g = ctx.tabs.lock().unwrap();
        g.list.push(Tab {
            label,
            title: String::new(),
            zoom: 1.0,
        });
        g.active = g.list.len() - 1;
    }

    apply_layout(app);
    let _ = app.emit("update-tabs", ());
}

#[tauri::command]
fn get_tabs(state: State<Ctx>) -> Vec<TabInfo> {
    let g = state.tabs.lock().unwrap();
    g.list
        .iter()
        .enumerate()
        .map(|(index, t)| TabInfo {
            title: t.title.clone(),
            index,
            active: index == g.active,
        })
        .collect()
}

#[tauri::command]
fn switch_tab(app: AppHandle, index: usize) {
    {
        let ctx = app.state::<Ctx>();
        let mut g = ctx.tabs.lock().unwrap();
        if index < g.list.len() {
            g.active = index;
        }
    }
    apply_layout(&app);
    let _ = app.emit("update-tabs", ());
    // keep window title in sync with the newly active tab
    let ctx = app.state::<Ctx>();
    let title = {
        let g = ctx.tabs.lock().unwrap();
        g.list.get(g.active).map(|t| t.title.clone())
    };
    if let Some(title) = title {
        let _ = main_window(&app).set_title(&title);
        update_tray(&app, icons::unread_messages(&title));
    }
}

#[tauri::command]
fn new_tab(app: AppHandle) {
    add_tab(&app, LOGIN.into());
}

#[tauri::command]
fn close_tab(app: AppHandle, index: usize) {
    let closed_label;
    let reopen;
    {
        let ctx = app.state::<Ctx>();
        let mut g = ctx.tabs.lock().unwrap();
        if index >= g.list.len() {
            return;
        }
        closed_label = g.list[index].label.clone();
        if g.list.len() == 1 {
            reopen = true;
        } else {
            reopen = false;
            g.list.remove(index);
            if g.active >= index && g.active > 0 {
                g.active -= 1;
            }
            if g.active >= g.list.len() {
                g.active = g.list.len() - 1;
            }
        }
    }

    if let Some(wv) = webview_by_label(&app, &closed_label) {
        let _ = wv.close();
    }

    if reopen {
        {
            let ctx = app.state::<Ctx>();
            let mut g = ctx.tabs.lock().unwrap();
            g.list.clear();
            g.active = 0;
        }
        add_tab(&app, LOGIN.into());
        return;
    }

    apply_layout(&app);
    let _ = app.emit("update-tabs", ());
}

// ---------------------------------------------------------------------------
// Hotkeys / actions
// ---------------------------------------------------------------------------

fn reload_active(app: &AppHandle) {
    let ctx = app.state::<Ctx>();
    let label = {
        let g = ctx.tabs.lock().unwrap();
        g.list.get(g.active).map(|t| t.label.clone())
    };
    if let Some(label) = label {
        if let Some(wv) = webview_by_label(app, &label) {
            let _ = wv.reload();
        }
    }
}

fn zoom_active(app: &AppHandle, factor: Option<f64>) {
    let ctx = app.state::<Ctx>();
    let (label, new_zoom) = {
        let mut g = ctx.tabs.lock().unwrap();
        let active = g.active;
        let Some(t) = g.list.get_mut(active) else {
            return;
        };
        let z = match factor {
            None => 1.0,
            Some(mult) => (t.zoom * mult).clamp(0.5, 3.0),
        };
        t.zoom = z;
        (t.label.clone(), z)
    };
    if let Some(wv) = webview_by_label(app, &label) {
        let _ = wv.set_zoom(new_zoom);
    }
}

fn hide_window(app: &AppHandle) {
    let _ = main_window(app).hide();
    update_tray(app, app.state::<Ctx>().misc.lock().unwrap().unread);
}

fn show_window(app: &AppHandle) {
    let w = main_window(app);
    let _ = w.show();
    let _ = w.set_focus();
    update_tray(app, app.state::<Ctx>().misc.lock().unwrap().unread);
}

fn toggle_window(app: &AppHandle) {
    let visible = main_window(app).is_visible().unwrap_or(false);
    if visible {
        hide_window(app);
    } else {
        show_window(app);
    }
}

fn toggle_menu(app: &AppHandle) {
    let ctx = app.state::<Ctx>();
    if ctx.settings.get_bool("menu", "alwaysShow", false) {
        return;
    }
    let revealed = {
        let mut m = ctx.misc.lock().unwrap();
        m.menu_revealed = !m.menu_revealed;
        m.menu_revealed
    };
    let w = main_window(app);
    if revealed {
        let _ = w.show_menu();
    } else {
        let _ = w.hide_menu();
    }
}

fn do_quit(app: &AppHandle) {
    {
        let ctx = app.state::<Ctx>();
        ctx.misc.lock().unwrap().quitting = true;
    }
    save_window(app);
    app.exit(0);
}

#[tauri::command]
fn hotkey(app: AppHandle, action: String) {
    match action.as_str() {
        "reload" | "force-reload" => reload_active(&app),
        "hide" => hide_window(&app),
        "quit" => do_quit(&app),
        "zoom-in" => zoom_active(&app, Some(1.2)),
        "zoom-out" => zoom_active(&app, Some(1.0 / 1.2)),
        "zoom-reset" => zoom_active(&app, None),
        "toggle-menu" => toggle_menu(&app),
        _ => {}
    }
}

#[tauri::command]
fn notification_click(app: AppHandle) {
    show_window(&app);
}

#[tauri::command]
fn chrome_version_bug(app: AppHandle) {
    log::info!("Detected chrome version bug. Reloading...");
    reload_active(&app);
}

// ---------------------------------------------------------------------------
// Window persistence (mirrors window-settings-module.ts)
// ---------------------------------------------------------------------------

fn save_window(app: &AppHandle) {
    let w = main_window(app);
    let maxed = w.is_maximized().unwrap_or(false);
    app.state::<Ctx>()
        .settings
        .set("window", "maximized", maxed.into());
    if !maxed {
        let sf = w.scale_factor().unwrap_or(1.0);
        if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
            let bounds = serde_json::json!({
                "x": pos.x as f64 / sf,
                "y": pos.y as f64 / sf,
                "width": size.width as f64 / sf,
                "height": size.height as f64 / sf,
            });
            app.state::<Ctx>().settings.set("window", "bounds", bounds);
        }
    }
}

// ---------------------------------------------------------------------------
// Tray (mirrors tray-module.ts)
// ---------------------------------------------------------------------------

fn tray_icon(greyscale: bool, unread: u32) -> Option<Image<'static>> {
    let name = match (greyscale, unread > 0) {
        (false, false) => "io.github.brunofin.Cohesion.png",
        (false, true) => "io.github.brunofin.Cohesion-unread.png",
        (true, false) => "io.github.brunofin.Cohesion-greyscale.png",
        (true, true) => "io.github.brunofin.Cohesion-greyscale-unread.png",
    };
    Image::from_path(icons::find_icon(name)).ok()
}

fn update_tray(app: &AppHandle, unread: u32) {
    {
        let ctx = app.state::<Ctx>();
        ctx.misc.lock().unwrap().unread = unread;
    }
    let ctx = app.state::<Ctx>();
    let guard = ctx.tray.lock().unwrap();
    let Some(tray) = guard.as_ref() else {
        return;
    };

    let greyscale = ctx.settings.get_bool("tray", "greyscale", false);
    let visible = main_window(app).is_visible().unwrap_or(true);

    let mut builder = MenuBuilder::new(app);
    if unread > 0 {
        let label = if unread == u32::MAX {
            "9+".to_string()
        } else {
            unread.to_string()
        };
        let info = MenuItemBuilder::with_id("tray-unread", format!("{label} unread notifications"))
            .enabled(false)
            .build(app)
            .unwrap();
        builder = builder.item(&info).separator();
    }
    let toggle_label = if visible {
        "Minimize to tray"
    } else {
        "Show Cohesion"
    };
    let grey_label = if greyscale {
        "Use color icon"
    } else {
        "Use greyscale icon"
    };
    let menu = builder
        .text("tray-toggle", toggle_label)
        .text("tray-greyscale", grey_label)
        .text("tray-quit", "Quit Cohesion")
        .build()
        .unwrap();

    let tooltip = if unread > 0 {
        let n = if unread == u32::MAX {
            "9+".to_string()
        } else {
            unread.to_string()
        };
        format!("Cohesion - {n} unread notifications")
    } else {
        "Cohesion".to_string()
    };

    let _ = tray.set_menu(Some(menu));
    let _ = tray.set_tooltip(Some(&tooltip));
    if let Some(icon) = tray_icon(greyscale, unread) {
        let _ = tray.set_icon(Some(icon));
    }
}

fn handle_tray_menu(app: &AppHandle, id: &str) {
    match id {
        "tray-toggle" => toggle_window(app),
        "tray-greyscale" => {
            let ctx = app.state::<Ctx>();
            let new = !ctx.settings.get_bool("tray", "greyscale", false);
            ctx.settings.set("tray", "greyscale", new.into());
            let unread = ctx.misc.lock().unwrap().unread;
            drop(ctx);
            update_tray(app, unread);
        }
        "tray-quit" => do_quit(app),
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Menu (mirrors menu-module.ts)
// ---------------------------------------------------------------------------

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let ctx = app.state::<Ctx>();
    let always_show = ctx.settings.get_bool("menu", "alwaysShow", false);
    let (spell_enabled, spell_langs) = current_spell(&ctx);

    let file = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("quit", "Quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?,
        )
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // Spell-check languages submenu.
    let available = spellcheck::available_languages();
    let mut lang_sub = SubmenuBuilder::new(app, "Spell Check Languages");
    if available.is_empty() {
        lang_sub = lang_sub.item(
            &MenuItemBuilder::with_id("lang-none", "No languages available")
                .enabled(false)
                .build(app)?,
        );
    } else {
        for code in available {
            let checked = spell_langs.contains(&code);
            lang_sub = lang_sub.item(
                &CheckMenuItemBuilder::with_id(format!("lang:{code}"), &code)
                    .checked(checked)
                    .build(app)?,
            );
        }
    }
    let lang_sub = lang_sub.build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("force-reload", "Force Reload")
                .accelerator("CmdOrCtrl+Shift+R")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zoom-reset", "Reset Zoom")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .separator()
        .item(
            &CheckMenuItemBuilder::with_id("spellcheck", "Spell Check")
                .checked(spell_enabled)
                .build(app)?,
        )
        .item(&lang_sub)
        .separator()
        .item(
            &CheckMenuItemBuilder::with_id("alwaysshow", "Always Show Menu Bar")
                .checked(always_show)
                .build(app)?,
        )
        .build()?;

    let about_meta = AboutMetadataBuilder::new()
        .name(Some("Cohesion"))
        .version(Some(app.package_info().version.to_string()))
        .website(Some("https://github.com/brunofin/cohesion"))
        .icon(tray_icon(false, 0))
        .build();

    let help = SubmenuBuilder::new(app, "Help")
        .text("whatsnew", "What's New")
        .about(Some(about_meta))
        .text("relnotes", "Release Notes")
        .separator()
        .text("licenses", "Open-Source Licenses")
        .build()?;

    MenuBuilder::new(app)
        .items(&[&file, &edit, &view, &help])
        .build()
}

/// Rebuild the window menu and reapply its visibility.
fn refresh_menu(app: &AppHandle) {
    let Ok(menu) = build_menu(app) else {
        return;
    };
    let w = main_window(app);
    let _ = w.set_menu(menu);
    apply_menu_visibility(app);
}

fn apply_menu_visibility(app: &AppHandle) {
    let ctx = app.state::<Ctx>();
    let always_show = ctx.settings.get_bool("menu", "alwaysShow", false);
    let revealed = ctx.misc.lock().unwrap().menu_revealed;
    let w = main_window(app);
    if always_show || revealed {
        let _ = w.show_menu();
    } else {
        let _ = w.hide_menu();
    }
}

fn handle_menu(app: &AppHandle, id: &str) {
    match id {
        "quit" => do_quit(app),
        "reload" | "force-reload" => reload_active(app),
        "zoom-in" => zoom_active(app, Some(1.2)),
        "zoom-out" => zoom_active(app, Some(1.0 / 1.2)),
        "zoom-reset" => zoom_active(app, None),
        "whatsnew" => show_whatsnew(app),
        "relnotes" => {
            let _ = app
                .opener()
                .open_url("https://github.com/brunofin/cohesion/releases", None::<&str>);
        }
        "licenses" => show_licenses(app),
        "spellcheck" => {
            let ctx = app.state::<Ctx>();
            let new = !ctx.settings.get_bool("spellcheck", "enabled", true);
            ctx.settings.set("spellcheck", "enabled", new.into());
            let langs = ctx.settings.get_strings("spellcheck", "languages");
            drop(ctx);
            for wv in main_window(app).webviews() {
                if wv.label().starts_with("tab-") {
                    spellcheck::apply(&wv, new, langs.clone());
                }
            }
            refresh_menu(app);
        }
        "alwaysshow" => {
            let ctx = app.state::<Ctx>();
            let new = !ctx.settings.get_bool("menu", "alwaysShow", false);
            ctx.settings.set("menu", "alwaysShow", new.into());
            ctx.misc.lock().unwrap().menu_revealed = new;
            drop(ctx);
            let w = main_window(app);
            if new {
                let _ = w.show_menu();
            } else {
                let _ = w.hide_menu();
            }
            refresh_menu(app);
        }
        other if other.starts_with("lang:") => {
            let code = other.trim_start_matches("lang:").to_string();
            let ctx = app.state::<Ctx>();
            let mut langs = ctx.settings.get_strings("spellcheck", "languages");
            if let Some(pos) = langs.iter().position(|l| l == &code) {
                langs.remove(pos);
            } else {
                langs.push(code);
            }
            ctx.settings
                .set("spellcheck", "languages", langs.clone().into());
            let enabled = current_spell(&ctx).0;
            drop(ctx);
            for wv in main_window(app).webviews() {
                if wv.label().starts_with("tab-") {
                    spellcheck::apply(&wv, enabled, langs.clone());
                }
            }
            refresh_menu(app);
        }
        _ => {}
    }
}

fn show_licenses(app: &AppHandle) {
    let content = data_file(app, "third-party-notices.txt")
        .and_then(|p| std::fs::read_to_string(p).ok())
        .unwrap_or_else(|| "Third-party notices file not found.".to_string());
    app.dialog()
        .message(content)
        .title("Open-Source Licenses")
        .blocking_show();
}

// ---------------------------------------------------------------------------
// What's New (mirrors whatsnew-module.ts)
// ---------------------------------------------------------------------------

fn data_file(app: &AppHandle, name: &str) -> Option<std::path::PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("data").join(name));
    }
    candidates.push(std::path::PathBuf::from("./data").join(name));
    candidates.push(std::path::PathBuf::from("../data").join(name));
    candidates.into_iter().find(|p| p.exists())
}

fn parse_releases(app: &AppHandle) -> Vec<Release> {
    let Some(path) = data_file(app, "io.github.brunofin.Cohesion.appdata.xml") else {
        return Vec::new();
    };
    let Ok(content) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let release_re = Regex::new(
        r#"(?s)<release\s+version="([^"]+)"\s+date="([^"]+)"(?:\s*/>|>(.*?)</release>)"#,
    )
    .unwrap();
    let p_re = Regex::new(r"(?s)<p>(.*?)</p>").unwrap();
    let mut releases = Vec::new();
    for cap in release_re.captures_iter(&content) {
        let version = cap[1].to_string();
        let date = cap[2].to_string();
        let desc = cap.get(3).map(|m| m.as_str()).unwrap_or("");
        let items = p_re
            .captures_iter(desc)
            .map(|c| c[1].trim().to_string())
            .collect();
        releases.push(Release {
            version,
            date,
            items,
        });
    }
    releases
}

fn current_release(app: &AppHandle) -> Option<Release> {
    let ctx = app.state::<Ctx>();
    let ver = app.package_info().version.to_string();
    ctx.releases.iter().find(|r| r.version == ver).cloned()
}

fn show_whatsnew(app: &AppHandle) {
    if webview_by_label(app, "whatsnew").is_some() {
        return;
    }
    if current_release(app).is_none() {
        return;
    }
    let w = main_window(app);
    let (cw, ch) = content_size(&w);
    let _ = w.add_child(
        WebviewBuilder::new("whatsnew", WebviewUrl::App("whatsnew.html".into())).transparent(true),
        LogicalPosition::new(0.0, 0.0),
        LogicalSize::new(cw, ch),
    );
    apply_layout(app);
}

#[tauri::command]
fn get_release_data(app: AppHandle) -> Option<ReleaseData> {
    let release = current_release(&app)?;
    let ctx = app.state::<Ctx>();
    let mut all = ctx.releases.clone();
    // dates are YYYY-MM-DD -> lexicographic desc == chronological desc
    all.sort_by(|a, b| b.date.cmp(&a.date));
    Some(ReleaseData {
        version: release.version,
        date: release.date,
        items: release.items,
        all_releases: all,
    })
}

#[tauri::command]
fn whatsnew_dismiss(app: AppHandle) {
    let ver = app.package_info().version.to_string();
    let ctx = app.state::<Ctx>();
    let mut seen = ctx.settings.get_strings("whatsnew", "seenVersions");
    if !seen.contains(&ver) {
        seen.push(ver);
        ctx.settings
            .set("whatsnew", "seenVersions", seen.into());
    }
    drop(ctx);
    if let Some(wv) = webview_by_label(&app, "whatsnew") {
        let _ = wv.close();
    }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            show_window(app);
            if let Some(url) = extract_url(argv) {
                add_tab(app, url);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_tabs,
            switch_tab,
            close_tab,
            new_tab,
            hotkey,
            notification_click,
            chrome_version_bug,
            get_release_data,
            whatsnew_dismiss,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();

            // Settings + parsed release notes.
            let config_path = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .join("config.json");
            let settings = Settings::load(config_path);
            let releases = {
                // parse needs an AppHandle but not Ctx; safe to call now.
                parse_releases(&handle)
            };
            app.manage(Ctx {
                settings,
                tabs: Mutex::new(Tabs::default()),
                tray: Mutex::new(None),
                misc: Mutex::new(Misc::default()),
                releases,
            });

            // Window with restored bounds.
            let ctx = app.state::<Ctx>();
            let bounds = ctx.settings.get("window", "bounds");
            let maximized = ctx.settings.get_bool("window", "maximized", false);
            let mut wb = WindowBuilder::new(app, "main")
                .title("Cohesion")
                .inner_size(1100.0, 700.0)
                .min_inner_size(650.0, 550.0);
            if let Some(b) = bounds.as_object() {
                if let (Some(x), Some(y), Some(width), Some(height)) = (
                    b.get("x").and_then(|v| v.as_f64()),
                    b.get("y").and_then(|v| v.as_f64()),
                    b.get("width").and_then(|v| v.as_f64()),
                    b.get("height").and_then(|v| v.as_f64()),
                ) {
                    wb = wb.inner_size(width, height).position(x, y);
                }
            }
            drop(ctx);
            let window = wb.build()?;
            if maximized {
                let _ = window.maximize();
            }

            // Tab bar.
            window.add_child(
                WebviewBuilder::new("tabbar", WebviewUrl::App("index.html".into())),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(1100.0, BAR_H),
            )?;

            // Menu + tray.
            let menu = build_menu(&handle)?;
            window.set_menu(menu)?;
            apply_menu_visibility(&handle);

            let tray = TrayIconBuilder::new()
                .icon(tray_icon(false, 0).expect("tray icon"))
                .tooltip("Cohesion")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(&tray.app_handle().clone());
                    }
                })
                .on_menu_event(|app, event| handle_tray_menu(&app.app_handle().clone(), event.id().as_ref()))
                .build(app)?;
            *app.state::<Ctx>().tray.lock().unwrap() = Some(tray);
            update_tray(&handle, 0);

            // Initial tab (deep-link URL if launched via notion://).
            let initial = extract_url(std::env::args()).unwrap_or_else(|| LOGIN.into());
            add_tab(&handle, initial);

            // Notion "open in new tab" -> new child webview.
            let listen_handle = handle.clone();
            app.listen("open-tab", move |event| {
                if let Ok(url) = serde_json::from_str::<String>(event.payload()) {
                    add_tab(&listen_handle, url);
                }
            });

            // ChromeVersionFix.onLoad: force a reload of the initial tab.
            reload_active(&handle);

            // Show unless --start-hidden.
            let start_hidden = std::env::args().any(|a| a == "--start-hidden");
            if !start_hidden {
                let _ = window.show();
            }

            // What's New on first launch of a new version.
            if let Some(release) = current_release(&handle) {
                let seen = app
                    .state::<Ctx>()
                    .settings
                    .get_strings("whatsnew", "seenVersions");
                if !seen.contains(&release.version) {
                    show_whatsnew(&handle);
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| handle_menu(&app.app_handle().clone(), event.id().as_ref()))
        .on_window_event(|window, event| match event {
            WindowEvent::Resized(_) => apply_layout(&window.app_handle()),
            WindowEvent::CloseRequested { api, .. } => {
                let app = window.app_handle();
                let quitting = app.state::<Ctx>().misc.lock().unwrap().quitting;
                if !quitting {
                    api.prevent_close();
                    hide_window(&app.clone());
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
