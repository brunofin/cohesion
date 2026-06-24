import {app, BrowserWindow} from 'electron';
import Cohesion from './cohesion';

let cohesionApp: Cohesion;
let mainWindow: BrowserWindow;
const protocol = 'notion';

function extractURL(args: string[]): string | undefined {
    const url = args?.find(arg => arg.startsWith(protocol + '://www.notion.so/'));
    if (!url) return undefined;
    return url.replace(protocol + '://', 'https://');
}

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(protocol, process.execPath, process.argv);
    }
} else {
    app.setAsDefaultProtocolClient(protocol);
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit();
} else {
    app.on('second-instance', (event, commandLine) => {
        if (cohesionApp) {
            const url = extractURL(commandLine);
            if (url) cohesionApp.openUrl(url);

            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    })

    app.whenReady().then(() => {
        cohesionApp = new Cohesion();
        mainWindow = cohesionApp.init(extractURL(process.argv));
    });
}
