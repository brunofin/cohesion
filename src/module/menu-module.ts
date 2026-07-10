import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions, shell } from "electron";
import { readFileSync } from "fs";
import { join } from "path";
import Cohesion from "../cohesion";
import Module from "./module";
import Settings from "../settings";
import SpellCheckModule from "./spellcheck-module";
import WhatsNewModule from "./whatsnew-module";

const settings = new Settings("menu");

export default class MenuModule extends Module {

    constructor(
        private readonly cohesion: Cohesion,
        private readonly window: BrowserWindow,
        private readonly spellcheck: SpellCheckModule,
        private readonly whatsnew: WhatsNewModule
    ) {
        super();
    }

    public override beforeLoad() {
        const iconBase = app.isPackaged ? join(process.resourcesPath, "..") : app.getAppPath();
        app.setAboutPanelOptions({
            applicationName: "Cohesion",
            applicationVersion: app.getVersion(),
            website: "https://github.com/brunofin/cohesion",
            iconPath: join(iconBase, "data", "icons", "hicolor", "512x512", "apps", "io.github.brunofin.Cohesion.png")
        });

        const alwaysShow = settings.get("alwaysShow", false);
        this.window.setAutoHideMenuBar(!alwaysShow);
        this.window.setMenuBarVisibility(alwaysShow);
    }

    public override onLoad() {
        const menu = this.buildMenu();
        Menu.setApplicationMenu(menu);
    }

    private buildMenu(): Menu {
        const alwaysShow = settings.get("alwaysShow", false);
        const template: MenuItemConstructorOptions[] = [
            {
                label: "File",
                submenu: [
                    {
                        label: "Quit",
                        accelerator: "CmdOrCtrl+Q",
                        click: () => this.cohesion.quit()
                    }
                ]
            },
            {
                label: "Edit",
                submenu: [
                    { role: "undo" },
                    { role: "redo" },
                    { type: "separator" },
                    { role: "cut" },
                    { role: "copy" },
                    { role: "paste" },
                    { role: "selectAll" }
                ]
            },
            {
                label: "View",
                submenu: [
                    {
                        label: "Reload",
                        accelerator: "CmdOrCtrl+R",
                        click: () => this.cohesion.reload()
                    },
                    {
                        label: "Force Reload",
                        accelerator: "CmdOrCtrl+Shift+R",
                        click: () => this.cohesion.reload()
                    },
                    { type: "separator" },
                    { role: "zoomIn" },
                    { role: "zoomOut" },
                    { role: "resetZoom" },
                    { type: "separator" },
                    {
                        label: "Spell Check",
                        type: "checkbox",
                        checked: this.spellcheck.enabled,
                        click: (menuItem) => {
                            this.spellcheck.setEnabled(menuItem.checked);
                        }
                    },
                    {
                        label: "Spell Check Languages",
                        submenu: this.buildLanguageSubmenu()
                    },
                    { type: "separator" },
                    {
                        label: "Always Show Menu Bar",
                        type: "checkbox",
                        checked: alwaysShow,
                        click: (menuItem) => {
                            const show = menuItem.checked;
                            settings.set("alwaysShow", show);
                            this.window.setAutoHideMenuBar(!show);
                            this.window.setMenuBarVisibility(show);
                        }
                    }
                ]
            },
            {
                label: "Help",
                submenu: [
                    {
                        label: "What's New",
                        click: () => this.whatsnew.show()
                    },
                    {
                        label: "About Cohesion",
                        click: () => app.showAboutPanel()
                    },
                    {
                        label: "Release Notes",
                        click: () => shell.openExternal("https://github.com/brunofin/cohesion/releases")
                    },
                    { type: "separator" },
                    {
                        label: "Open-Source Licenses",
                        click: () => this.showLicenses()
                    }
                ]
            }
        ];

        return Menu.buildFromTemplate(template);
    }

    private rebuildMenu() {
        Menu.setApplicationMenu(this.buildMenu());
    }

    private getLanguageDisplayName(code: string): string {
        try {
            return new Intl.DisplayNames("en", {type: "language"}).of(code) ?? code;
        } catch {
            return code;
        }
    }

    private buildLanguageSubmenu(): MenuItemConstructorOptions[] {
        const available = this.spellcheck.getAvailableLanguages().sort(
            (a, b) => this.getLanguageDisplayName(a).localeCompare(this.getLanguageDisplayName(b))
        );

        if (available.length === 0) {
            return [{
                label: "No languages available",
                enabled: false
            }];
        }

        const current = this.spellcheck.languages;

        return available.map(code => ({
            label: this.getLanguageDisplayName(code),
            type: "checkbox",
            checked: current.includes(code),
            click: () => {
                const langs = [...current];
                const idx = langs.indexOf(code);
                if (idx >= 0) {
                    langs.splice(idx, 1);
                } else {
                    langs.push(code);
                }
                this.spellcheck.setLanguages(langs);
                this.rebuildMenu();
            }
        }));
    }

    private showLicenses() {
        const base = app.isPackaged ? join(process.resourcesPath, "..") : app.getAppPath();
        const licensePath = join(base, "data", "third-party-notices.txt");
        let content: string;
        try {
            content = readFileSync(licensePath, "utf-8");
        } catch {
            content = "Third-party notices file not found.";
        }
        dialog.showMessageBox(this.window, {
            type: "info",
            title: "Open-Source Licenses",
            message: "Third-Party Notices",
            detail: content,
            buttons: ["OK"]
        });
    }
}
