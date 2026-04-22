import { app, session } from "electron";
import fs from "fs";
import path from "path";
import Settings from "../settings.js";
import Fix from "./fix.js";

const settings = new Settings("fixes");

/**
 * Fixes #35, clears corrupt storage data.
 */
export default class Electron21Fix extends Fix {

    public override beforeLoad() {
        if (!settings.get("electron-21", false)) {
            console.info("Clearing storage data...");

            // Electron.Session#clearStorageData isn't clearing service workers :/
            fs.rmSync(path.join(app.getPath("userData"), "Service Worker"), {
                recursive: true,
                force: true
            });

            session.defaultSession.clearStorageData();

            settings.set("electron-21", true);
        }
    }
}
