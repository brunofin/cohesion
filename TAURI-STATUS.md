# Tauri Migration — Status

Branch: `tauri`. Goal: 1:1 port of the Electron Cohesion app to Tauri v2.

## Where we are

The full Rust port compiles cleanly and runs. Notion loads and renders,
menu/tray/tabs/what's-new code is all ported. **One blocker prevents shipping**
(see below).

### Working
- `cargo build --manifest-path src-tauri/Cargo.toml` — clean, zero errors.
- App launches, logs into Notion, renders the workspace.
- Menu bar (File/Edit/View/Help), tray (tooltip shows page title), tab pill,
  What's New overlay content, confetti, deep-link (`notion://`) handling,
  settings persistence, spellcheck wiring — all ported.
- Config file: `~/.config/io.github.brunofin.Cohesion/config.json`
  (separate from the old Electron store at `~/.config/cohesion/`; not migrated,
  intentionally).
- `Settings` uses **flat** keys (`"whatsnew.seenVersions"`), self-consistent.
  To suppress What's New for testing:
  `echo '{"whatsnew.seenVersions":["1.1.1"]}' > ~/.config/io.github.brunofin.Cohesion/config.json`

## BLOCKER: child webviews are equal-packed, not positioned

Multiple webviews on one window (tab bar + Notion content, + What's New overlay)
render as **equal-sized stacked blocks** instead of absolutely positioned/overlaid:
- 2 webviews (tabbar + content) → 50% / 50%
- 3 webviews (+ whatsnew) → 33% / 33% / 33%

`apply_layout`'s `set_position`/`set_size` calls are silently ignored, and the
What's New "overlay" renders as a third block instead of a transparent layer.

### Root cause (confirmed from wry source)
`wry` v0.55.1 `src/webkitgtk/mod.rs::add_to_container`:
```rust
if container_type == "GtkBox" {
    container.pack_start(webview, true, true, 0);  // equal expand — ignores x/y/size
} else if container_type == "GtkFixed" {
    container.put(webview, x, y);                  // absolute positioning
    is_in_fixed_parent = true;
}
```
`set_bounds()` (backing `set_position`/`set_size`) only acts `if is_in_fixed_parent`.
Absolute positioning of child webviews lives entirely behind
`#[cfg(feature = "x11")]` (positioned X11 child windows). On our stack the
webviews land in a `GtkBox` and get equal-expanded.

### What was ruled out
- **Native menu** — disabling `window.set_menu()` did NOT fix it. Still 50/50.
- **Wayland GDK backend** — forcing `GDK_BACKEND=x11` did NOT fix it either.
  Still equal-packed. So it's not simply "use X11".
- Not a stale single-instance artifact (reproduced on clean launches).
- `unstable` feature IS enabled on the `tauri` crate (multiwebview available).

### Environment
- wry 0.55.1, tao 0.35.3, tauri 2.11.5.
- webkit2gtk-4.1 2.52.4, gtk+-3.0 3.24.52.
- Session exposes both X11 (`:0`) and Wayland (`wayland-1`).
- Run: `(WEBKIT_DISABLE_COMPOSITING_MODE=1 setsid ./src-tauri/target/debug/app >/tmp/tauri-run.log 2>&1 &)`
- Screenshots: `grim /tmp/x.png` then downscale (`magick x.png -resize 800x -quality 70 x.jpg`)
  — full-res PNGs exceed the tool media size limit.
- Kill the app with `pkill -9 -x app` (exact name; `pkill -f target/debug/app`
  also kills the invoking shell).

## Next directions to investigate (unstarted)

1. **wry `x11` feature — RULED OUT.** It IS enabled/compiled in:
   `cargo tree -f '{p} {f}' -p wry` →
   `wry v0.55.1 gdkx11,...,webkit2gtk,x11,x11-dl`. So the positioned-child
   (X11 child window) code path exists in the binary. The fallback to `GtkBox`
   is therefore a runtime routing issue, not a compile-out.
2. **PRIME SUSPECT: how `tauri-runtime-wry` adds `add_child` webviews.** Since
   the x11 path is compiled in yet unused (and `GDK_BACKEND=x11` didn't help),
   the child webviews are likely added via `new_gtk` into the main window's
   `GtkBox` instead of `new_as_child` (positioned X11 window). Read
   `tauri-runtime-wry` webview-creation for `add_child`: find whether/when it
   uses `new_as_child` vs `new_gtk`, and what container it passes. Start here
   next session.
3. **Confirm the live GTK backend at runtime** (log `gdk::Display` type). Even
   with `GDK_BACKEND=x11` set, verify GDK actually selected X11.
4. Fallback architecture if positioned child webviews stay unavailable:
   - tab bar as a separate always-on-top borderless `WebviewWindow` pinned to
     the top of the main window (multiwindow instead of multiwebview), and
     What's New as its own centered transparent `WebviewWindow`.
   - or drop the separate tab-bar webview: render tabs in a small top window and
     keep exactly one content webview.

## Diagnostics have been reverted

`src-tauri/src/lib.rs` is back to intended behavior: menu re-enabled, temporary
`eprintln!` layout logging removed. Build is clean. Safe to commit.
