import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { StatusUpdater } from './LyricCord';
import Store from 'electron-store';

interface StoreSchema {
    discordToken: string;
    geniusApiKey: string;
}

let mainWindow: BrowserWindow | null = null;
let configWindow: BrowserWindow | null = null;
let statusUpdater: StatusUpdater | null = null;

// Initialize electron store
const store = new Store<StoreSchema>({
    encryptionKey: 'lyriccord-secure-key',
    defaults: {
        discordToken: '',
        geniusApiKey: ''
    }
});

function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 600,
        height: 600,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '..', 'icons', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    configWindow.loadFile('config.html');
    configWindow.on('closed', () => {
        configWindow = null;
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '..', 'icons', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function checkConfig(): boolean {
    const token = store.get('discordToken');
    const apiKey = store.get('geniusApiKey');
    return token !== '' && apiKey !== '';
}

app.whenReady().then(() => {
    if (!checkConfig()) {
        createConfigWindow();
    } else {
        createMainWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null && configWindow === null) {
        if (!checkConfig()) {
            createConfigWindow();
        } else {
            createMainWindow();
        }
    }
});

// Configuration window IPC handlers
ipcMain.on('get-config', (event) => {
    event.reply('config-data', {
        discordToken: store.get('discordToken'),
        geniusApiKey: store.get('geniusApiKey')
    });
});

ipcMain.on('save-config', (event, config) => {
    try {
        store.set('discordToken', config.discordToken);
        store.set('geniusApiKey', config.geniusApiKey);
        event.reply('config-status', {
            success: true,
            message: 'Configuration saved successfully!'
        });
    } catch (error: any) {
        event.reply('config-status', {
            success: false,
            message: error?.message || 'Failed to save configuration'
        });
    }
});

ipcMain.on('skip-config', () => {
    if (checkConfig()) {
        configWindow?.close();
        createMainWindow();
    }
});

ipcMain.on('config-done', () => {
    configWindow?.close();
    createMainWindow();
});

// Handle opening config from main window
ipcMain.on('open-config', () => {
    if (!configWindow) {
        createConfigWindow();
    } else {
        configWindow.focus();
    }
});

// Main window IPC handlers
ipcMain.on('start-updater', (event, config) => {
    try {
        if (statusUpdater) {
            statusUpdater.stop();
        }
        
        // Merge saved API keys with song configuration
        const fullConfig = {
            ...config,
            discordToken: store.get('discordToken'),
            geniusApiKey: store.get('geniusApiKey'),
            onLyricsLoaded: (lyrics: string[]) => {
                if (mainWindow) {
                    mainWindow.webContents.send('lyrics-loaded', lyrics);
                }
            },
            onStatusUpdate: (lyric: string) => {
                if (mainWindow) {
                    mainWindow.webContents.send('status-update', lyric);
                }
            }
        };
        
        statusUpdater = new StatusUpdater(fullConfig);
        
        event.reply('updater-status', { 
            success: true, 
            message: 'Status updater started successfully!' 
        });
    } catch (error: any) {
        event.reply('updater-status', { 
            success: false, 
            message: error?.message || 'An unknown error occurred'
        });
    }
});

// Handle stopping the status updater
ipcMain.on('stop-updater', (event) => {
    try {
        if (statusUpdater) {
            statusUpdater.stop();
            statusUpdater = null;
            event.reply('updater-status', {
                success: true,
                message: 'Status updater stopped successfully!'
            });
        }
    } catch (error: any) {
        event.reply('updater-status', {
            success: false,
            message: error?.message || 'Failed to stop status updater'
        });
    }
});
