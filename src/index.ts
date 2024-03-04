import {app, BrowserWindow} from 'electron';
import Notion from './notion';

let mainWindow: BrowserWindow;


if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('notion', process.execPath, [process.argv[1]]);
    }
} else {
    app.setAsDefaultProtocolClient('notion');
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    
    app.whenReady().then(() => {
        mainWindow = new Notion().init()
 
        app.on('open-url', (event, url) => {
            mainWindow.loadURL(url);
        })
    });
}
