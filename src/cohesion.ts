import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import ChromeVersionFix from "./fix/chrome-version-fix";
import Electron21Fix from "./fix/electron-21-fix";
import HotkeyModule from "./module/hotkey-module";
import ModuleManager from "./module/module-manager";
import TrayModule from "./module/tray-module";
import WindowSettingsModule from "./module/window-settings-module";

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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
    


    // this is probably where I should regisetr external and internal URLs
    private makeLinksOpenInBrowser() {

        this.window.webContents.setWindowOpenHandler(details => {

//            console.log(details.url, this.window.webContents.getURL(), details.url === this.window.webContents.getURL())
//
//            if (details.url.includes('verifyNoPopupBlockerHtmlAndRedirect')) {
//                const url = decodeURIComponent(details.url.split(('redirectUri='))[1]);
//                console.log(url);
//                shell.openExternal(url);
//                return { action: 'deny' };
//            }

            if (details.url != this.window.webContents.getURL()) {
                shell.openExternal(details.url);
                return { action: 'deny' };
            }
        });
    }

    private registerListeners() {
        app.on('second-instance', () => {
            this.window.show();
            this.window.focus();
        });

        ipcMain.on('notification-click', () => this.window.show());
    }
};
