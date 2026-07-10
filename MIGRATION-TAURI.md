# Migration: Electron → Tauri v2

**Date:** 2026-06-25
**Current:** Electron 42.5.0 / TypeScript 6.0.3
**Target:** Tauri 2.x / Rust + frontend

---

## 1. Why Tauri?

| Dimension | Electron (current) | Tauri v2 | Delta |
|---|---|---|---|
| Bundle size | ~200 MB | ~10–30 MB | ~6-20x smaller |
| Idle RAM | ~300 MB | ~50–100 MB | ~3-6x lower |
| Startup time | ~2s | ~0.5s | ~4x faster |
| Node.js shipped | Yes | No | Smaller attack surface |
| Chromium bundled | Yes | No (uses system WebKitGTK) | |

**The open question — Notion in WebKitGTK:** You confirmed this works from a previous test. That's the make-or-break check. If Notion renders correctly in WebKitGTK, there's no blocker.

---

## 2. Architecture Comparison

### Current (Electron)

```
┌──────────────────────────────────────┐
│  Electron Main Process (Node.js)      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ Cohesion.ts  │  │ Modules      │  │
│  │ - Window     │  │ - Menu       │  │
│  │ - Tabs       │  │ - Tray       │  │
│  │ - IPC        │  │ - Spellcheck │  │
│  │              │  │ - Hotkeys    │  │
│  │              │  │ - Window     │  │
│  │              │  │   Settings   │  │
│  └──────────────┘  └──────────────┘  │
├──────────────────────────────────────┤
│  Renderer Process 1: BrowserWindow    │
│  ┌──────────────────────────────────┐ │
│  │ tabs.html (tab bar UI)           │ │
│  │ contextIsolation: true           │ │
│  │ tabsPreload.js (contextBridge)   │ │
│  └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  Renderer Process 2..N: WebContentsView│
│  ┌──────────────────────────────────┐ │
│  │ notion.so (Notion content)       │ │
│  │ contextIsolation: false          │ │
│  │ notionPreload.js (raw IPC)       │ │
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Target (Tauri)

```
┌─────────────────────────────────────────────┐
│  Tauri Rust Backend (src-tauri/)             │
│  ┌─────────────────────────────────────────┐ │
│  │ lib.rs (main)                           │ │
│  │ - App builder (plugins, setup, tray)    │ │
│  │ - Commands (IPC handlers)               │ │
│  │ - Tray icon + menu                      │ │
│  │ - Window event handlers                 │ │
│  │ - Tab manager (multi-webview)           │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  Webview 1: Main (tab bar + shell)           │
│  ├── Frontend framework (vanilla/Svelte/React)│
│  ├── Tab bar UI                              │
│  ├── Window chrome (if any)                  │
│  └── IPC calls via @tauri-apps/api           │
├─────────────────────────────────────────────┤
│  Webview 2..N: Notion content tabs           │
│  ├── notion.so loaded via WebviewUrl::External│
│  ├── Preload script (inject JS)             │
│  └── Limited IPC (events only, no commands) │
└─────────────────────────────────────────────┘
```

---

## 3. Feature Mapping

### 3.1 Tab Management (Multi-Webview)

| Current (Electron) | Tauri Equivalent | Notes |
|---|---|---|
| `WebContentsView` per tab | `WebviewBuilder` + `window.add_child()` | Multi-webview is behind `unstable` Cargo feature. Must enable in `Cargo.toml`. |
| `window.contentView.addChildView()` | `window.add_child(webview, position, size)` | Rust-side API. Need to manage bounds manually on window resize. |
| `webContents.loadURL()` | `WebviewUrl::External(url)` | Supports `https://` external URLs directly. |
| `webContents.setWindowOpenHandler()` | `on_new_window()` callback on `WebviewBuilder` | Equivalent — intercept and create new child webview. |
| `webContents.on('page-title-updated')` | `on_document_title_changed()` callback | Equivalent — update window title and trigger tab bar re-render. |
| `webContents.reloadIgnoringCache()` | `webview.reload()` | No ignore-cache variant needed; Tauri's reload respects no-cache by convention. |
| `webContents.zoomLevel` / `getZoomFactor()` | No direct API — use JS `document.body.style.zoom` | Must implement zoom via injected JavaScript. Tauri v2 `WebviewOptions.zoomHotkeysEnabled` provides Ctrl+/=/- zoom hotkeys. |

**Architecture Decision: Tab Bar Location**

Two options for tab bar:

**Option A: Tab bar in the main webview (recommended)**
- Main webview loads a local HTML page (vanilla JS / Svelte / React)
- Tab bar rendered inside this webview
- Communicates to Rust backend via IPC (`invoke` / `listen`)
- Notion tabs are additional child webviews positioned below the tab bar

**Option B: Tab bar via Rust (custom titlebar)**
- All tabs managed purely in Rust
- Use `on_document_title_changed` and events to update state
- Tab bar rendered as HTML overlaid... not practical

**Verdict: Option A** — the current architecture maps almost 1:1.

### 3.2 Main Window

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `new BrowserWindow({width, height, minWidth, minHeight})` | `tauri.conf.json` → `app.windows[0].width` etc. | Declared in config, not code. |
| `window.show() / .hide() / .isVisible()` | `window.show()` / `.hide()` / `.isVisible()` | Same API via `@tauri-apps/api/window`. |
| `window.setTitle()` | `window.setTitle()` | Same API. |
| `window.setBounds()` / `getBounds()` | `window.setSize()` / `getSize()` + `.setPosition()` / `.getPosition()` | Split into size + position. |
| `window.maximize()` / `isMaximized()` | `window.maximize()` / `.isMaximized()` | Same API. |
| `window.on('resize')` | `onResize()` event | Same. |
| `window.close()` → tray hide | `onCloseRequested()` → `window.hide()` + `api.prevent_close()` | Rust-side `WindowEvent::CloseRequested`. |
| Minimize to tray on close | `on_window_event(CloseRequested)` handler in Rust | Prevent close, hide instead. |
| `menuBar: autoHideMenuBar` | No equivalent — Tauri doesn't have a menu bar | Tauri application menus are always visible (or always hidden). No auto-hide/Alt-key reveal. |

**⚠️ No auto-hide menu bar:** Tauri's menu is always shown (or not shown at all). If Alt-key menu bar toggle is important, you'd need a custom titlebar or a keyboard shortcut that opens a menu popup. This is a UX regression from Electron.

### 3.3 Application Menu

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `Menu.buildFromTemplate()` | `Menu.new()` / `Menu.with_items()` | JS API in `@tauri-apps/api/menu`. |
| `MenuItem`, `CheckMenuItem`, `Separator` | `MenuItem`, `CheckMenuItem`, `NativeIcon` | All available in JS API. |
| `role: "undo"`, `role: "cut"`, etc. | No built-in roles | Must implement each menu item manually with keyboard shortcuts. |
| Accelerators (`CmdOrCtrl+Q`) | `accelerator: "CmdOrCtrl+Q"` | Supported in menu items. |
| `menu.setAsAppWindowMenu()` | From JS API | Set as app menu. |
| About panel (`app.setAboutPanelOptions`) | Not available as native dialog | Must build a custom About dialog or use `tauri-plugin-dialog` with `message()`. |
| `dialog.showMessageBox()` | `tauri-plugin-dialog` → `message()` or `confirm()` | Official plugin, works well. |
| `shell.openExternal()` | `tauri-plugin-opener` → `openUrl()` | Official plugin. |
| Dynamic rebuild on language toggle | `menu.setAsAppMenu()` with new menu | Tauri allows replacing the menu. |

### 3.4 System Tray

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `Tray` with icon, tooltip | `TrayIcon` with `icon`, `tooltip`, `menu` | `tauri::tray::TrayIconBuilder` in Rust, or `@tauri-apps/api/tray`. |
| Tray context menu | `TrayIconBuilder.menu()` | Supports `Menu` with items, check items, separators. |
| Click/double-click events | `on_tray_icon_event()` callback | Rust callback: `TrayIconEvent::Click` / `DoubleClick`. |
| Icon switching (color/greyscale) | `tray.set_icon(icon)` | Replace icon at runtime. Must load from path or embedded. |
| Tooltip ("Cohesion - N unread") | `TrayIconBuilder.tooltip()` | Update via `app.tray().set_tooltip()`. |
| Menu on left click | `menu_on_left_click: true` | Supported. |

### 3.5 Spell Check

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `session.defaultSession.spellCheckerEnabled = bool` | No direct API | WebKitGTK spell check is controlled per-input via HTML `spellcheck` attribute and WebKit settings. |
| `session.setSpellCheckerLanguages()` | No direct API | Cannot set languages programmatically from Tauri. |
| `session.availableSpellCheckerLanguages` | No equivalent | Cannot enumerate available languages. |
| `Intl.DisplayNames` for UI | Same (in frontend JS) | Can still format language names. |

**⚠️ Major gap:** Tauri (WebKitGTK) does not expose a spell check API comparable to Electron's. WebKitGTK has spell check built-in, but language settings come from the OS/GTK input method configuration, not from the app. The only control available is the HTML `spellcheck` attribute (`true`/`false`) on inputs.

**Workaround for language selection:** You could inject a `<style>` or mutation observer that sets `spellcheck="true"` on all contenteditable/input elements inside the Notion webview. But language selection would need to be done at the OS level (or via WebKitGTK settings if you write custom Rust FFI).

**Feasibility:** You could call the WebKitGTK C API via Rust FFI to set the spell check language, but this is complex and fragile. Alternatively, accept that spell check uses the system language and keep only the on/off toggle.

### 3.6 Single Instance + Protocol Handler

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `app.requestSingleInstanceLock()` | `tauri-plugin-single-instance` | Official plugin. Uses DBus on Linux. Must be registered first. |
| `second-instance` event → extract notion:// URL | Plugin callback: `\|app, argv, cwd\| { app.emit("single-instance", ...) }` | On Linux, second instance passes URL as CLI arg. Plugin emits event to first instance. |
| `app.setAsDefaultProtocolClient('notion')` | `tauri-plugin-deep-link` | Register `notion` scheme in `tauri.conf.json → plugins.deep-link.desktop.schemes`. |
| `extractURL()` → open in new tab | Deep link callback `onOpenUrl()` or single-instance argv | On Linux, deep links spawn new instance; single-instance plugin captures the argv. |

**Combined pattern:** `single-instance` + `deep-link` plugins together. The deep-link plugin registers the scheme, and on Linux the single-instance plugin catches the second-invocation argv (which contains the `notion://` URL).

### 3.7 Window State Persistence

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `electron-store` (11.0.2) | `tauri-plugin-store` | Official plugin. Async key-value store backed by JSON file. |
| `settings.get("bounds")` | `store.get("window.bounds")` | Same pattern, async API. |
| `settings.set("bounds", ...)` | `store.set("window.bounds", ...)` | Same. |
| Save on quit | `app.onWindowEvent(CloseRequested)` or `onExitRequested` | Save on window close, not just quit. |

### 3.8 Notion Preload Script

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `notionPreload.ts` runs in each tab | Tauri `on_page_load()` with injected JS | Use `webview.eval()` or `on_page_load()` to inject notification override + chrome version check. |
| `window.Notification` override | `webview.eval()` on page load | Inject a script that overrides `Notification`. |
| `ipcRenderer.send("notification-click")` | `emit("notification-click")` via Tauri event system | Events work across webviews in Tauri. |
| Chrome version bug detection (DOM check) | `webview.eval()` on page load | Inject a mutation observer that watches for the incompatibility element. |

**Note:** IPC from an externally-loaded page (`WebviewUrl::External`) to Tauri backend works through Tauri's event system (`emit`/`listen`), not through `invoke` commands (which require origin validation). This is a documented limitation — `invoke` may not work with external origins. Use events instead.

### 3.9 Keyboard Shortcuts

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `before-input-event` handler | Menu accelerators + `tauri-plugin-global-shortcut` | Menu accelerators handle most shortcuts. |
| Ctrl+W (hide window), Ctrl+Q (quit) | Menu items with accelerators | Menu accelerators work even when menu is hidden. |
| Ctrl+R / F5 (reload) | Menu item accelerator | Can also use Tauri's built-in zoom hotkeys. |
| Ctrl+=/0/- (zoom) | `WebviewOptions.zoomHotkeysEnabled: true` | Built-in option on `WebviewBuilder`. |
| Ctrl+Shift+R (force reload) | Menu item | Manual implementation via `webview.reload()`. |

### 3.10 Window Close → Hide to Tray

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `window.on('close', (e) => { if (!quitting) { e.preventDefault(); hide(); } })` | `on_window_event(WindowEvent::CloseRequested { api, .. }) { window.hide(); api.prevent_close(); }` | Rust handler. Prevent close and hide instead. |
| `quitting` flag to distinguish real quit | `code.is_none()` on `ExitRequested` vs `code.is_some()` | If exit has no code, it's a "natural" close (prevent). If it has a code (from tray "Quit"), allow. |

**Pattern (Rust):**
```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        window.hide().unwrap();
        api.prevent_close();
    }
})
```

### 3.11 Unread Notification Detection

| Current | Tauri Equivalent | Notes |
|---|---|---|
| `cleanTitle()` regex parse for `(N)` or `(9+)` | Same — on `on_document_title_changed()` | Parse still happens in Rust callback. |
| Update tray icon badge + tooltip | `tray.set_icon()` + `tray.set_tooltip()` | Same concept, different API. |
| 4 icon variants (color/greyscale × read/unread) | Same icon strategy | Embed all 4 as PNG resources. |

### 3.12 Electron 21 Fix (Service Worker Cleanup)

No migration needed. This fix was a one-time cleanup for an Electron 21 bug. Tauri uses WebKitGTK, not Chromium's service worker implementation.

---

## 4. Frontend Options

Since Tauri is frontend-agnostic, we have a choice:

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Vanilla HTML/CSS/JS** | Zero build step, matches current approach, smallest bundle | Limited component model, manual state mgmt | ✅ **Best for minimal port** |
| **Svelte** | Compiles to tiny JS, built-in state management, easy to learn | Added build tooling (Vite) | ✅ **Best for new development** |
| **React** | Largest ecosystem, familiar to most devs | Heavier bundle, JSX compile step | Only if team prefers it |
| **Vue** | Good DX, gentle learning curve | Added build tooling | Viable option |

**Tab bar frontend scope is small** (~100 lines of HTML/CSS/JS currently). Vanilla JS is adequate and reduces dependencies. The main webview (tab bar + app shell) doesn't need a framework.

---

## 5. Build & Distribution

### 5.1 Flatpak

| Current | Tauri Target |
|---|---|
| `org.electronjs.Electron2.BaseApp` 25.08 runtime | `org.gnome.Sdk` / `org.freedesktop.Sdk` (WebKitGTK) |
| `zypak-wrapper.sh` for sandbox | No zypak needed for Tauri |
| `flatpak-node-generator` for npm deps | `cargo` dependencies managed by Cargo.toml |
| `electron-builder` for package | `tauri build` for package |
| `-c.electronDist=...` workaround | No electronDist needed |

### 5.2 Binary Build

| Current | Tauri Target |
|---|---|
| `npm run build` → electron-builder | `cargo tauri build` → creates .deb, .AppImage, .rpm |
| Build output: `build/linux-unpacked/` (~200 MB) | Build output: `src-tauri/target/release/bundle/` (~10-30 MB) |
| TypeScript compilation | TypeScript compilation (frontend only) |

### 5.3 Icons

| Current | Tauri Target |
|---|---|
| 12 tray icon files (4 variants × 3 sizes + 2 drawings) | Same, but Tauri uses its own icon convention (see `tauri icon` CLI) |
| `data/icons/hicolor/` | `src-tauri/icons/` (generated by `cargo tauri icon`) |
| `util.ts` → `findIcon()` in XDG paths | Built-in icon resolution |

---

## 6. Migration Risks

### 🔴 High Risk
| Risk | Mitigation |
|---|---|
| **Notion rendering in WebKitGTK** — CSS/JS quirks, missing Chrome APIs | Already tested and confirmed working by you. But regression-test thoroughly. |
| **Spell check language selection** — no Tauri API to set languages | Accept OS-level language only, or build Rust FFI to WebKitGTK C API. |
| **IPC from external URL** — `invoke` may not work with `WebviewUrl::External` | Use events (`emit`/`listen`) instead of commands for Notion webview IPC. |

### 🟡 Medium Risk
| Risk | Mitigation |
|---|---|
| **No auto-hide menu bar** — Tauri menus are always visible or absent | Learn to live without it, or build a custom popup menu triggered by a key. |
| **Multi-webview stability** — behind `unstable` feature flag | Test thoroughly. The feature has been in development since 2023 and is used in production by some apps. |
| **Tab bar resizing with webviews** — manual bounds management | Listen to `onResize` and reposition all child webviews. Same as current approach. |
| **Menu roles** — no built-in Edit menu (undo/redo/cut/copy/paste) | Implement manually with keyboard shortcuts + menu items. |

### 🟢 Low Risk
| Risk | Mitigation |
|---|---|
| Rust learning curve | The Rust backend is small (~200-400 lines). Frontend stays TypeScript. |
| Plugin ecosystem | All needed plugins exist and are maintained. |
| Build system migration | `cargo tauri` handles most complexity. |

---

## 7. Migration Phases

### Phase 1: Scaffold + Prove Rendering
1. `npm create tauri-app` → Tauri + vanilla TS
2. Load `https://notion.so/login` in the main webview
3. Confirm login, page editing, search all work in WebKitGTK
4. Check: can you create/read/edit Notion pages without issues?

### Phase 2: Core Tab Infrastructure (Rust backend)
1. Enable `unstable` feature for multi-webview
2. Implement tab manager in Rust: `Vec<Webview>` with add/switch/close
3. Implement IPC commands: `get_tabs`, `switch_tab`, `close_tab`
4. Implement `on_new_window` handler to create child webviews
5. Implement `on_document_title_changed` → update tab list + window title
6. Wire up tab bar frontend to communicate via IPC

### Phase 3: Window Management
1. Window state persistence (`tauri-plugin-store`)
2. Close→hide-to-tray (`on_window_event`)
3. Single instance + protocol handler (`deep-link` + `single-instance` plugins)
4. `--start-hidden` flag (parse CLI args in Rust `setup()`)

### Phase 4: Chrome
1. Menu bar (File > Quit, Edit, View, Help with all items)
2. System tray icon + context menu + click handlers
3. Unread notification badges (parse title, update icon + tooltip)
4. Icon switching (color/greyscale)

### Phase 5: Notion-Specific
1. Preload script injection (Notification override, chrome version detection)
2. Dynamic user-agent (no longer relevant — WebKitGTK has its own UA)
3. Notification click → focus window

### Phase 6: Polish + Build
1. Spell check on/off (via HTML attribute injection)
2. Keyboard shortcuts (menu accelerators + global shortcuts)
3. Flatpak packaging
4. Browser extension (no change needed — already ships independently)

---

## 8. Estimated Effort

| Phase | Lines of Code | Rust New | JS/TS New | JS/TS Port | Time Estimate |
|---|---|---|---|---|---|
| 1. Scaffold + rendering test | 0 | 0 | 0 | 0 | 1 day (test only) |
| 2. Core tabs | ~600 | 400 | 200 | 0 | 1 week |
| 3. Window management | ~200 | 150 | 50 | 0 | 2-3 days |
| 4. Chrome (menu + tray) | ~400 | 200 | 200 | 0 | 3-4 days |
| 5. Notion-specific | ~100 | 50 | 50 | 50 (preload) | 1 day |
| 6. Polish + build | ~200 | 50 | 50 | 0 | 2-3 days |
| **Total** | **~1500** | **~850** | **~550** | **~50** | **~2-3 weeks** |

---

## 9. Key Tauri Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "unstable"] }
tauri-plugin-single-instance = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
tauri-plugin-opener = "2"
tauri-plugin-global-shortcut = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## 10. Key NPM Dependencies (Frontend)

```json
{
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "typescript": "^5"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-store": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-opener": "^2",
    "@tauri-apps/plugin-global-shortcut": "^2"
  }
}
```
