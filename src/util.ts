import { app, nativeImage } from "electron";
import fs from "fs";
import path from "path";

export function findIcon(name: string) {
    let iconPath = fromDataDirs("icons/hicolor/512x512/apps/" + name);

    if (iconPath === null)
        iconPath = path.join("./data/icons/hicolor/512x512/apps/", name);

    return nativeImage.createFromPath(iconPath);
}

export function getUnreadMessages(title: string) {
    const matches = title.match(/\(\d+\)/);
    return matches == null ? 0 : Number.parseInt(matches[0].match(/\d+/)[0]);
}

function fromDataDirs(iconPath: string) {
    for (let dataDir of process.env.XDG_DATA_DIRS.split(":")) {
        let fullPath = path.join(dataDir, iconPath);
        if (fs.existsSync(fullPath))
            return fullPath;
    }
    return null;
}
