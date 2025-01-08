import { BrowserWindow, Menu, MenuItem, Tray } from "electron";
import { findIcon, getUnreadMessages } from "../util";
import Cohesion from "../cohesion";
import Module from "./module";
import Settings from "../settings";

const ICON = findIcon("io.github.brunofin.Cohesion.png");
const ICON_UNREAD = findIcon("io.github.brunofin.Cohesion-unread.png");
const ICON_GREYSCALE = findIcon("io.github.brunofin.Cohesion-greyscale.png");
const ICON_GREYSCALE_UNREAD = findIcon("io.github.brunofin.Cohesion-greyscale-unread.png");

const settings = new Settings("tray");

export default class TrayModule extends Module {

    private readonly tray: Tray;

    constructor(
        private readonly cohesion: Cohesion,
        private readonly window: BrowserWindow
    ) {
        super();
        this.tray = new Tray(settings.get("greyscale", false) ? ICON_GREYSCALE : ICON);
    }

    public override onLoad() {
        this.updateMenu();
        this.registerListeners();
    }

    private updateMenu(unread = getUnreadMessages(this.window.title)) {
        const menu = Menu.buildFromTemplate([
            {
                label: this.window.isVisible() ? "Minimize to tray" : "Show Cohesion",
                click: () => this.onClickFirstItem(unread)
            },
            {
                label: settings.get("greyscale", false) ? "Use color icon" : "Use greyscale icon",
                click: () => {
                    settings.set("greyscale", !settings.get("greyscale", false));

                    this.tray.setImage(unread == 0 ?
                        (settings.get("greyscale", false) ? ICON_GREYSCALE : ICON) :
                        (settings.get("greyscale", false) ? ICON_GREYSCALE_UNREAD : ICON_UNREAD));
                    
                    this.updateMenu(unread);
                }
            },
            {
                label: "Quit Cohesion",
                click: () => this.cohesion.quit()
            },
        ]);

        let tooltip = "Cohesion";

        if (unread !== 0) {
            menu.insert(0, new MenuItem({
                label: (unread === Infinity ? "9+" : unread) + " unread notifications",
                enabled: false
            }));

            menu.insert(1, new MenuItem({ type: "separator" }));

            tooltip = tooltip + " - " + unread + " unread notifications";
        }

        this.tray.setContextMenu(menu);
        this.tray.setToolTip(tooltip);
    }

    private onClickFirstItem(unread = getUnreadMessages(this.window.title)) {
        if (this.window.isVisible()) {
            this.window.hide();
        } else {
            this.window.show();
            this.window.focus();
        }

        this.updateMenu(unread);
    }

    private registerListeners() {
        this.window.on("show", () => this.updateMenu());
        this.window.on("hide", () => this.updateMenu());

        this.window.on("close", event => {
            if (this.cohesion.quitting) return;

            event.preventDefault();
            this.window.hide();
        });

        this.window.webContents.on("page-title-updated", (_event, title, explicitSet) => {
            if (!explicitSet) return;

            const unread = getUnreadMessages(title);
            
            this.updateMenu(unread);
            this.tray.setImage(unread == 0 ? 
                (settings.get("greyscale", false) ? ICON_GREYSCALE : ICON) :
                (settings.get("greyscale", false) ? ICON_GREYSCALE_UNREAD : ICON_UNREAD));
        });
        
        this.tray.on("click", () => this.onClickFirstItem());
        this.tray.on("double-click", () => this.onClickFirstItem());
    }
};
