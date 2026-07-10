// Spell check via WebKitGTK (mirrors src/module/spellcheck-module.ts).
// ponytail: WebKitGTK has no language-enumeration API, so available languages are
// discovered by scanning hunspell/myspell dict dirs. Ceiling: only finds system
// hunspell dictionaries; add aspell/enchant scan if a user reports a missing language.
use std::collections::BTreeSet;

/// Apply enable + languages to a single Notion webview's WebKit context.
#[cfg(target_os = "linux")]
pub fn apply(webview: &tauri::Webview, enabled: bool, languages: Vec<String>) {
    use webkit2gtk::{WebContextExt, WebViewExt};
    let _ = webview.with_webview(move |pw| {
        let wv = pw.inner();
        if let Some(ctx) = wv.context() {
            ctx.set_spell_checking_enabled(enabled);
            if !languages.is_empty() {
                let refs: Vec<&str> = languages.iter().map(String::as_str).collect();
                ctx.set_spell_checking_languages(&refs);
            }
        }
    });
}

#[cfg(not(target_os = "linux"))]
pub fn apply(_webview: &tauri::Webview, _enabled: bool, _languages: Vec<String>) {}

/// Language codes with an installed hunspell/myspell dictionary, e.g. "en_US".
pub fn available_languages() -> Vec<String> {
    let dirs = [
        "/usr/share/hunspell",
        "/usr/share/myspell",
        "/usr/share/myspell/dicts",
        "/app/share/hunspell",
    ];
    let mut set = BTreeSet::new();
    for dir in dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for e in entries.flatten() {
                let name = e.file_name();
                let name = name.to_string_lossy();
                if let Some(code) = name.strip_suffix(".dic") {
                    set.insert(code.to_string());
                }
            }
        }
    }
    set.into_iter().collect()
}
