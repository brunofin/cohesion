import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import ChromeVersionFix from "./fix/chrome-version-fix";
import Electron21Fix from "./fix/electron-21-fix";
import HotkeyModule from "./module/hotkey-module";
import ModuleManager from "./module/module-manager";
import TrayModule from "./module/tray-module";
import WindowSettingsModule from "./module/window-settings-module";

const USER_AGENT = app.userAgentFallback.replace(/\sElectron\/[\d.]+/g, "");

export default class Cohesion {

    private readonly window: BrowserWindow;
    private readonly moduleManager: ModuleManager;
    public quitting = false;

    constructor() {
        this.window = new BrowserWindow({
            title: "Cohesion",
            width: 1100,
            height: 700,
            minWidth: 650,
            minHeight: 550,
            show: !process.argv.includes("--start-hidden"),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: false, // native Notification override in preload :(
                spellcheck: !process.argv.includes("--disable-spellcheck"),
            }
        });

        this.moduleManager = new ModuleManager([
            new Electron21Fix(),
            new HotkeyModule(this, this.window),
            new TrayModule(this, this.window),
            new WindowSettingsModule(this, this.window),
            new ChromeVersionFix(this)
        ]);
    }

    public init(preloadUrl?: string): BrowserWindow {
        this.makeLinksOpenInBrowser();
        this.registerListeners();

        this.moduleManager.beforeLoad();

        // TODO: add button to enable dev tools
        this.window.setMenu(null);
        this.window.loadURL(preloadUrl ?? 'https://notion.so/login', { userAgent: USER_AGENT });
        // this.window.webContents.openDevTools();

        this.moduleManager.onLoad();
        
        return this.window;
    }

    public reload() {
        this.window.webContents.reloadIgnoringCache();
    }

    public quit() {
        this.quitting = true;
        this.moduleManager.onQuit();
        app.quit();
    }
    

private makeLinksOpenInBrowser() {
  this.window.webContents.setWindowOpenHandler((details) => {
    if (this.shouldOpenInsideApp(details.url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          parent: this.window,
          width: 520,
          height: 720,
          title: "Cohesion Authentication",
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            spellcheck: !process.argv.includes("--disable-spellcheck"),
          },
        },
      };
    }

    shell.openExternal(details.url);
    return { action: "deny" };
  });

  this.window.webContents.on("did-create-window", (childWindow: BrowserWindow) => {
    childWindow.setMenu(null);

    childWindow.webContents.setWindowOpenHandler((details) => {
      if (this.shouldOpenInsideApp(details.url)) {
        return { action: "allow" };
      }

      shell.openExternal(details.url);
      return { action: "deny" };
    });
  });
}

private shouldOpenInsideApp(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    return (
      host === "notion.so" ||
      host === "www.notion.so" ||
      host.endsWith(".notion.so") ||
      host === "notion.com" ||
      host === "www.notion.com" ||
      host.endsWith(".notion.com") ||
      host === "accounts.google.com" ||
      host === "appleid.apple.com" ||
      host === "login.microsoftonline.com"
    );
  } catch {
    return false;
  }
}

    private registerListeners() {
        app.on('second-instance', () => {
            this.window.show();
            this.window.focus();
        });

        ipcMain.on('notification-click', () => this.window.show());
    }
};
