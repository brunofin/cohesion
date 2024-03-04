import { BrowserWindow, Menu, MenuItem, Tray } from "electron";
import { findIcon, getUnreadMessages } from "../util";
import Notion from "../notion";
import Module from "./module";

const ICON = findIcon("io.github.brunofin.NotionDesktop.png");
const ICON_UNREAD = findIcon("io.github.brunofin.NotionDesktop-unread.png");

export default class TrayModule extends Module {

    private readonly tray: Tray;

    constructor(
        private readonly whatsApp: Notion,
        private readonly window: BrowserWindow
    ) {
        super();
        this.tray = new Tray(ICON);
    }

    public override onLoad() {
        this.updateMenu();
        this.registerListeners();
    }

    private updateMenu(unread: number = getUnreadMessages(this.window.title)) {
        const menu = Menu.buildFromTemplate([
            {
                label: this.window.isVisible() ? "Minimize to tray" : "Show Notion",
                click: () => this.onClickFirstItem()
            },
            {
                label: "Quit Notion",
                click: () => this.whatsApp.quit()
            }
        ]);

        let tooltip = "Notion";

        if (unread != 0) {
            menu.insert(0, new MenuItem({
                label: unread + " unread notifications",
                enabled: false
            }));

            menu.insert(1, new MenuItem({ type: "separator" }));

            tooltip = tooltip + " - " + unread + " unread notifications";
        }

        this.tray.setContextMenu(menu);
        this.tray.setToolTip(tooltip);
    }

    private onClickFirstItem() {
        if (this.window.isVisible()) {
            this.window.hide();
        } else {
            this.window.show();
            this.window.focus();
        }

        this.updateMenu();
    }

    private registerListeners() {
        this.window.on("show", () => this.updateMenu());
        this.window.on("hide", () => this.updateMenu());

        this.window.on("close", event => {
            if (this.whatsApp.quitting) return;

            event.preventDefault();
            this.window.hide();
        });

        this.window.webContents.on("page-title-updated", (_event, title, explicitSet) => {
            if (!explicitSet) return;

            let unread = getUnreadMessages(title);

            this.updateMenu(unread);
            this.tray.setImage(unread == 0 ? ICON : ICON_UNREAD);
        });
    }
};
