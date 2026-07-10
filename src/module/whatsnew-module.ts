import { app, BrowserWindow, WebContentsView, ipcMain } from "electron";
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
    private overlay: WebContentsView | null = null;
    private readonly resizeOverlay = () => this.fitOverlay();

    constructor(
        private readonly window: BrowserWindow
    ) {
        super();
        this.parseReleases();
    }

    public override beforeLoad() {
        ipcMain.on('whatsnew-dismiss', () => {
            this.markSeen(app.getVersion());
            this.close();
        });
    }

    private parseReleases() {
        const base = app.isPackaged ? join(process.resourcesPath, "..") : app.getAppPath();
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
        if (this.overlay) {
            return;
        }

        const release = this.getCurrentRelease();
        if (!release) return;

        this.overlay = new WebContentsView({
            webPreferences: {
                preload: join(__dirname, '..', 'whatsnewPreload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                transparent: true,
            }
        });
        this.overlay.setBackgroundColor('#00000000');

        this.overlay.webContents.loadFile(join(__dirname, '..', 'whatsnew.html'));

        const allReleases = [...this.releases].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        this.overlay.webContents.on('did-finish-load', () => {
            this.overlay?.webContents.send('release-data', {
                version: release.version,
                date: release.date,
                items: release.items,
                allReleases,
            });
        });

        this.window.contentView.addChildView(this.overlay);
        this.fitOverlay();
        this.window.on('resize', this.resizeOverlay);
    }

    private fitOverlay() {
        if (!this.overlay) return;
        const { width, height } = this.window.getContentBounds();
        this.overlay.setBounds({ x: 0, y: 0, width, height });
    }

    private close() {
        if (!this.overlay) return;
        this.window.off('resize', this.resizeOverlay);
        this.window.contentView.removeChildView(this.overlay);
        this.overlay = null;
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
