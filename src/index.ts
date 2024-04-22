import {app, BrowserWindow} from 'electron';
import Cohesion from './cohesion';

let mainWindow: BrowserWindow;
const protocol = 'notion';

function extractURL(args: string[]): string {
    let url: string = args?.find(arg => arg.startsWith(protocol + '://www.notion.so/'));
    if (!url) return;
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
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            const url = extractURL(commandLine);
            if (url) mainWindow.loadURL(url);
            
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    
    app.whenReady().then(() => {
        mainWindow = new Cohesion().init(extractURL(process.argv))
    });
}
