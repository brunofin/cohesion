// Icon path resolution (mirrors src/util.ts findIcon) + unread-count title parse.
use std::path::PathBuf;

use regex::Regex;

/// Find an icon by filename in XDG data dirs, falling back to the repo `data/` dir (dev).
pub fn find_icon(name: &str) -> PathBuf {
    let rel = format!("icons/hicolor/512x512/apps/{name}");
    let dirs =
        std::env::var("XDG_DATA_DIRS").unwrap_or_else(|_| "/usr/local/share:/usr/share".into());
    for dir in dirs.split(':') {
        let full = PathBuf::from(dir).join(&rel);
        if full.exists() {
            return full;
        }
    }
    PathBuf::from("./data").join(&rel)
}

/// Unread count from a window title. `(N)` -> N, `(9+)` -> u32::MAX, else 0.
pub fn unread_messages(title: &str) -> u32 {
    if let Some(m) = Regex::new(r"\((\d+)\)").unwrap().captures(title) {
        return m[1].parse().unwrap_or(0);
    }
    if title.starts_with("(9+)") {
        return u32::MAX;
    }
    0
}
