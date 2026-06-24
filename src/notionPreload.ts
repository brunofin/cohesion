import { ipcRenderer } from "electron";

function overrideNotification() {
    window.Notification = class extends Notification {
        constructor(title: string, options: NotificationOptions) {
            super(title, options);
            this.onclick = _event => ipcRenderer.send("notification-click");
        }
    }
}

function handleChromeVersionBug() {
    window.addEventListener("DOMContentLoaded", () => {
        if (document.getElementsByClassName("landing-title version-title").length != 0)
            ipcRenderer.send("chrome-version-bug");
    });
}

overrideNotification();
handleChromeVersionBug();
