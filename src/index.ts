import { app } from 'electron';
import Notion from './notion';

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit();
}

app.whenReady().then(() => new Notion().init());
