import { app, BrowserWindow, ipcMain } from "electron";
import { readFileSync } from "fs";
import { join } from "path";
import Module from "./module";
import Settings from "../settings";

const settings = new Settings("whatsnew");

interface Release {
    version: string;
    date: string;
    items: string[];
}

export default class WhatsNewModule extends Module {
    private releases: Release[] = [];
    private modal: BrowserWindow | null = null;

    constructor(
        private readonly window: BrowserWindow
    ) {
        super();
        this.parseReleases();
    }

    public override beforeLoad() {
        ipcMain.on('whatsnew-dismiss', () => {
            this.markSeen(app.getVersion());
            if (this.modal) {
                this.modal.close();
                this.modal = null;
            }
        });
    }

    private parseReleases() {
        const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const appdataPath = join(base, "data", "io.github.brunofin.Cohesion.appdata.xml");
        let content: string;
        try {
            content = readFileSync(appdataPath, "utf-8");
        } catch {
            return;
        }

        const releaseRegex = /<release\s+version="([^"]+)"\s+date="([^"]+)"(?:\s*\/>|>([\s\S]*?)<\/release>)/g;
        let match: RegExpExecArray | null;
        while ((match = releaseRegex.exec(content)) !== null) {
            const version = match[1];
            const date = match[2];
            const desc = match[3] || "";
            const items: string[] = [];
            const pRegex = /<p>([\s\S]*?)<\/p>/g;
            let pMatch: RegExpExecArray | null;
            while ((pMatch = pRegex.exec(desc)) !== null) {
                items.push(pMatch[1].trim());
            }
            this.releases.push({version, date, items});
        }
    }

    private getCurrentRelease(): Release | null {
        const currentVersion = app.getVersion();
        return this.releases.find(r => r.version === currentVersion) ?? null;
    }

    public show() {
        if (this.modal) {
            this.modal.focus();
            return;
        }

        const release = this.getCurrentRelease();
        if (!release) return;

        this.modal = new BrowserWindow({
            width: 520,
            height: 420,
            parent: this.window,
            modal: true,
            resizable: true,
            title: `What's New in Cohesion ${release.version}`,
            autoHideMenuBar: true,
            webPreferences: {
                preload: join(__dirname, '..', 'whatsnewPreload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            }
        });

        this.modal.loadFile(join(__dirname, '..', 'whatsnew.html'));

        const allReleases = [...this.releases].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        this.modal.webContents.on('did-finish-load', () => {
            this.modal?.webContents.send('release-data', {
                version: release.version,
                date: release.date,
                items: release.items,
                allReleases,
            });
        });

        this.modal.on('closed', () => {
            this.modal = null;
        });
    }

    public override onLoad() {
        const release = this.getCurrentRelease();
        if (!release) return;

        const seen: string[] = settings.get("seenVersions", []);
        if (seen.includes(release.version)) return;

        setImmediate(() => this.show());
    }

    private markSeen(version: string) {
        const seen: string[] = settings.get("seenVersions", []);
        if (!seen.includes(version)) {
            seen.push(version);
            settings.set("seenVersions", seen);
        }
    }
}
