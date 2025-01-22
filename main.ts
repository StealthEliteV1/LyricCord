import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { StatusUpdater } from './LyricCord';
import Store from 'electron-store';
import * as crypto from 'crypto';

interface StoreSchema {
    discordToken: string;
    emojiId?: string;
    emojiName?: string;
    discordStatus?: string;
    geniusApiKey?: string;
}

let mainWindow: BrowserWindow | null = null;
let configWindow: BrowserWindow | null = null;
let statusUpdater: StatusUpdater | null = null;

// Generate a unique encryption key for this installation
function getOrCreateEncryptionKey(): string {
    const keyPath = path.join(app.getPath('userData'), '.encryption-key');
    let encryptionKey: string;
    
    try {
        encryptionKey = require('fs').readFileSync(keyPath, 'utf8');
    } catch {
        // Generate a new key if none exists
        encryptionKey = crypto.randomBytes(32).toString('hex');
        require('fs').writeFileSync(keyPath, encryptionKey);
    }
    
    return encryptionKey;
}

// Initialize electron store with encryption
const store = new Store<StoreSchema>({
    encryptionKey: getOrCreateEncryptionKey(),
    defaults: {
        discordToken: '',
        discordStatus: 'online'
    }
});

function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 600,
        height: 600,
        autoHideMenuBar: true,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
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
        resizable: false,
        maximizable: false,
        fullscreenable: false,
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
    const emojiId = store.get('emojiId');
    const emojiName = store.get('emojiName');
    return token !== '' && emojiId !== undefined && emojiName !== undefined;
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
        emojiId: store.get('emojiId'),
        emojiName: store.get('emojiName'),
        discordStatus: store.get('discordStatus'),
        geniusApiKey: store.get('geniusApiKey')
    });
});

ipcMain.on('save-config', (event, config) => {
    try {
        store.set('discordToken', config.discordToken);
        if (config.geniusApiKey) {
            store.set('geniusApiKey', config.geniusApiKey);
        }
        if (config.emojiId && config.emojiName) {
            store.set('emojiId', config.emojiId);
            store.set('emojiName', config.emojiName);
        }
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

// Handle emoji updates from the main window
ipcMain.on('update-emoji', (event, config) => {
    try {
        if (config.emojiId && config.emojiName) {
            store.set('emojiId', config.emojiId);
            store.set('emojiName', config.emojiName);
        }
        if (config.discordStatus) {
            store.set('discordStatus', config.discordStatus);
        }
        event.reply('updater-status', {
            success: true,
            message: 'Settings updated successfully!'
        });
    } catch (error: any) {
        event.reply('updater-status', {
            success: false,
            message: error?.message || 'Failed to update settings'
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
        
        const emojiId = store.get('emojiId');
        const emojiName = store.get('emojiName');
        const geniusApiKey = store.get('geniusApiKey');
        const discordStatus = store.get('discordStatus');
        
        // Merge saved config with song configuration
        const fullConfig = {
            ...config,
            discordToken: store.get('discordToken'),
            emojiId: emojiId || '',  // Provide empty string if no emoji set
            emojiName: emojiName || '', // Provide empty string if no emoji set
            discordStatus: discordStatus || 'online', // Default to online if not set
            geniusApiKey: geniusApiKey || '', // Provide empty string if no Genius API key set
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
