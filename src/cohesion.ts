import {app, BrowserWindow, WebContentsView, ipcMain, LoadURLOptions} from "electron";
import path from "path";
import ChromeVersionFix from "./fix/chrome-version-fix";
import Electron21Fix from "./fix/electron-21-fix";
import HotkeyModule from "./module/hotkey-module";
import ModuleManager from "./module/module-manager";
import TrayModule from "./module/tray-module";
import WindowSettingsModule from "./module/window-settings-module";

const USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome.split('.')[0]}.0.0.0 Safari/537.36`;

export default class Cohesion {

    private readonly tabsHeight: number = 48;
    private readonly window: BrowserWindow;
    private readonly moduleManager: ModuleManager;
    private readonly tabsView: WebContentsView;
    private readonly tabs: Array<WebContentsView>;
    private currentTab: WebContentsView | null = null;
    private activeTab: number = 0;
    public quitting = false;
    public onTitleUpdate?: (title: string, explicitSet: boolean) => void;

    private readonly loadURLOptions: LoadURLOptions = {userAgent: USER_AGENT}

    private cleanTitle(title: string): string {
        return title.replace(/\s*[–—|]\s*Notion$/, '').trim();
    }

    private setupTabs() {
        this.tabsView.setBounds({x: 0, y: 0, width: this.window.getBounds().width, height: this.tabsHeight})
        this.tabsView.webContents.loadFile(path.join(__dirname, 'tabs.html'));
        this.window.contentView.addChildView(this.tabsView);
    }

    private updateTabBarVisibility() {
        const bounds = this.window.getBounds();
        const showTabs = this.tabs.length > 1;

        this.tabsView.setBounds({
            x: 0, y: 0,
            width: bounds.width,
            height: showTabs ? this.tabsHeight : 0,
        });

        for (const tab of this.tabs) {
            tab.setBounds({
                x: 0,
                y: showTabs ? this.tabsHeight : 0,
                width: bounds.width,
                height: showTabs ? bounds.height - this.tabsHeight : bounds.height,
            });
        }
    }

    private openTab(url: string) {
        const newContent = new WebContentsView({
            webPreferences: {
                preload: path.join(__dirname, 'notionPreload.js'),
                contextIsolation: false,
                spellcheck: !process.argv.includes("--disable-spellcheck"),
            }
        });

        newContent.webContents.loadURL(url, this.loadURLOptions);

        newContent.webContents.setWindowOpenHandler(details => {
            this.openTab(details.url);
            return {action: 'deny'};
        });

        newContent.webContents.on('page-title-updated', (_event, title, explicitSet) => {
            if (this.quitting) return;

            if (explicitSet && newContent === this.currentTab) {
                const cleaned = this.cleanTitle(title);
                this.window.setTitle(cleaned);
                this.onTitleUpdate?.(cleaned, explicitSet);
            }

            this.tabsView.webContents.send('update-tabs');
        });

        newContent.webContents.on('before-input-event', (event, input) => {
            const key = input.key.toUpperCase();

            if (input.control && key === 'W') {
                this.window.hide();
                event.preventDefault();
            } else if (input.control && key === 'Q') {
                this.quit();
                event.preventDefault();
            } else if (input.control && key === 'R') {
                this.currentTab?.webContents.reloadIgnoringCache();
                event.preventDefault();
            } else if (key === 'F5') {
                this.currentTab?.webContents.reloadIgnoringCache();
                event.preventDefault();
            } else if (input.control && (key === '+' || key === '=')) {
                if (this.currentTab && this.currentTab.webContents.getZoomFactor() < 3)
                    this.currentTab.webContents.zoomLevel += 1;
                event.preventDefault();
            } else if (input.control && key === '0') {
                this.currentTab?.webContents.setZoomLevel(0);
                event.preventDefault();
            } else if (input.control && key === '-') {
                if (this.currentTab && this.currentTab.webContents.getZoomFactor() > 0.5)
                    this.currentTab.webContents.zoomLevel -= 1;
                event.preventDefault();
            }
        });

        this.tabs.push(newContent);
        this.updateTabBarVisibility();
        this.switchTab(this.tabs.length - 1);
        this.tabsView.webContents.send('update-tabs');
    }

    private switchTab(index: number) {
        const newTab = this.tabs[index];
        if (!newTab || newTab === this.currentTab) return;

        if (this.currentTab) {
            this.window.contentView.removeChildView(this.currentTab);
        }
        this.window.contentView.addChildView(newTab);
        this.currentTab = newTab;
        this.activeTab = index;

        this.window.setTitle(this.cleanTitle(newTab.webContents.getTitle()));
        this.tabsView.webContents.send('update-tabs');
    }

    private closeTab(index: number) {
        const tab = this.tabs[index];
        if (!tab) return;

        const wasActive = index === this.activeTab;

        if (this.tabs.length === 1) {
            this.openTab('https://notion.so/login');
            this.window.contentView.removeChildView(tab);
            this.tabs.splice(index, 1);
            this.activeTab = 0;
            this.currentTab = this.tabs[0];
            this.updateTabBarVisibility();
            this.tabsView.webContents.send('update-tabs');
            return;
        }

        if (wasActive) {
            const newIndex = index === 0 ? 1 : index - 1;
            this.switchTab(newIndex);
        } else {
            if (index < this.activeTab) {
                this.activeTab--;
            }
        }

        this.window.contentView.removeChildView(tab);
        this.tabs.splice(index, 1);
        this.updateTabBarVisibility();
        this.tabsView.webContents.send('update-tabs');
    }

    constructor() {
        this.window = new BrowserWindow({
            title: "Cohesion",
            width: 1100,
            height: 700,
            minWidth: 650,
            minHeight: 550,
            show: !process.argv.includes("--start-hidden"),
        });

        this.window.on('resize', () => this.updateTabBarVisibility());

        this.moduleManager = new ModuleManager([
            new Electron21Fix(),
            new HotkeyModule(this, this.window),
            new TrayModule(this, this.window),
            new WindowSettingsModule(this, this.window),
            new ChromeVersionFix(this)
        ]);

        this.tabsView = new WebContentsView({
            webPreferences: {
                preload: path.join(__dirname, 'tabsPreload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            }
        });
        this.tabs = new Array<WebContentsView>();
    }

    public init(preloadUrl?: string): BrowserWindow {
        this.moduleManager.beforeLoad();

        this.window.setMenu(null);
        this.registerListeners();

        this.setupTabs();
        this.openTab(preloadUrl ?? 'https://notion.so/login');

        this.moduleManager.onLoad();

        return this.window;
    }

    public reload() {
        if (this.currentTab) {
            this.currentTab.webContents.reloadIgnoringCache();
        }
    }

    public openUrl(url: string) {
        this.openTab(url);
    }

    public quit() {
        this.quitting = true;
        this.moduleManager.onQuit();
        app.quit();
    }

    private registerListeners() {
        app.on('second-instance', () => {
            this.window.show();
            this.window.focus();
        });

        ipcMain.on('notification-click', () => this.window.show());

        ipcMain.handle('get-tabs', () => {
            return this.tabs.map((tab, index) => ({
                title: this.cleanTitle(tab.webContents.getTitle()),
                index,
                active: index === this.activeTab,
            }));
        });

        ipcMain.on('switch-tab', (event, index) => {
            this.switchTab(index);
        });

        ipcMain.on('close-tab', (event, index) => {
            this.closeTab(index);
        });
    }
};
