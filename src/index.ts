import {app, BrowserWindow} from 'electron';
import Cohesion from './cohesion';

let mainWindow: BrowserWindow;
let preloadUrl: string;

app.on('open-url', (event, url) => {
    preloadUrl = url;
    console.log('title2', preloadUrl);
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
    console.log('title1', 'start');
    
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            console.log('title', event, commandLine.join(' '), workingDirectory);
            mainWindow.loadURL(commandLine.pop().slice(0, -1));
            
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
    
    app.whenReady().then(() => {
        mainWindow = new Cohesion().init(preloadUrl)
        console.log('title1', preloadUrl);
    });
}
