import { ipcMain } from "electron";
import Notion from "../notion";
import Fix from "./fix";

export default class ChromeVersionFix extends Fix {

    constructor(private readonly whatsApp: Notion) {
        super();
    }

    public override onLoad() {
        this.whatsApp.reload();

        ipcMain.on("chrome-version-bug", () => {
            console.info("Detected chrome version bug. Reloading...");
            this.whatsApp.reload();
        });
    }
}
