import { ipcMain } from "electron";
import Cohesion from "../cohesion.js";
import Fix from "./fix.js";

export default class ChromeVersionFix extends Fix {

    constructor(private readonly cohesion: Cohesion) {
        super();
    }

    public override onLoad() {
        this.cohesion.reload();

        ipcMain.on("chrome-version-bug", () => {
            console.info("Detected chrome version bug. Reloading...");
            this.cohesion.reload();
        });
    }
}
