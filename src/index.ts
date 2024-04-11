import {app, BrowserWindow} from 'electron';
import Cohesion from './cohesion';

let mainWindow: BrowserWindow;

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
    app.on('second-instance', (event, commandLine) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            let url: string = commandLine?.find(arg => arg.startsWith('notion://www.notion.so/'));
            if (url) url = url.replace('notion://', 'https://');
            mainWindow.loadURL(url);
            
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    
    app.whenReady().then(() => {
        let url: string = process.argv?.find(arg => arg.startsWith('notion://www.notion.so/'));
        if (url) url = url.replace('notion://', 'https://');

        mainWindow = new Cohesion().init(url)
    });
}
