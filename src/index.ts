import {app, BrowserWindow, dialog} from 'electron';
import Cohesion from './cohesion';

let mainWindow: BrowserWindow;
let preloadUrl: string;

app.on('open-url', (event, url) => {
    preloadUrl = url;
    // dialog.showErrorBox('title2', preloadUrl);
})

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('notion', process.execPath, process.argv);
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
            // dialog.showErrorBox('title', commandLine.join(' '));
            mainWindow.loadURL(commandLine.pop().slice(0, -1));
            
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    
    app.whenReady().then(() => {
        mainWindow = new Cohesion().init(preloadUrl)
        // dialog.showErrorBox('title1', preloadUrl);
    });
}
