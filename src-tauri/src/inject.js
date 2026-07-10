// Injected into every Notion webview at document-start (parity: src/notionPreload.ts
// + the Alt/F5 handling from cohesion.ts before-input-event). Ctrl-based hotkeys and
// zoom are handled by the native menu accelerators; only F5 + Alt live here.
(function () {
  function inv(cmd, args) {
    var t = window.__TAURI__;
    if (t && t.core && t.core.invoke) return t.core.invoke(cmd, args);
    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke)
      return window.__TAURI_INTERNALS__.invoke(cmd, args);
  }

  // window.Notification override -> click focuses the app window.
  var _N = window.Notification;
  if (_N) {
    var Wrapped = function (title, options) {
      var n = new _N(title, options);
      n.onclick = function () {
        inv("notification_click");
      };
      return n;
    };
    Wrapped.prototype = _N.prototype;
    Object.defineProperty(Wrapped, "permission", {
      get: function () {
        return _N.permission;
      },
    });
    Wrapped.requestPermission = function () {
      return _N.requestPermission.apply(_N, arguments);
    };
    window.Notification = Wrapped;
  }

  // Chrome-version incompatibility page detection -> ask Rust to reload.
  window.addEventListener("DOMContentLoaded", function () {
    if (document.getElementsByClassName("landing-title version-title").length !== 0)
      inv("chrome_version_bug");
  });

  // Alt-tap toggles the menu bar; F5 reloads.
  var altArmed = false;
  window.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Alt" && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        altArmed = true;
        return;
      }
      altArmed = false;
      if (e.key === "F5") {
        inv("hotkey", { action: "reload" });
        e.preventDefault();
      }
    },
    true
  );
  window.addEventListener(
    "keyup",
    function (e) {
      if (e.key === "Alt" && altArmed) {
        altArmed = false;
        inv("hotkey", { action: "toggle-menu" });
        e.preventDefault();
      }
    },
    true
  );
})();
