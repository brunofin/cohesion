import { ipcMain } from "electron";
import Cohesion from "../cohesion";
import Fix from "./fix";

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
