import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { ZkService, ZkNode } from './zkService';
import { SshTunnelService, SshTunnelConfig } from './sshTunnel';

log.initialize();
log.info('ZkClient starting...');

let mainWindow: BrowserWindow | null = null;
let zkService: ZkService | null = null;
let sshTunnelService: SshTunnelService | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  log.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'ZkClient',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log.error(`Failed to load: ${errorCode} - ${errorDescription}`);
  });
}

interface ConnectionConfig {
  connectionString: string;
  sshTunnel?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    remoteHost: string;
    remotePort: number;
  };
}

ipcMain.handle('zk:connect', async (_event, config: ConnectionConfig) => {
  try {
    let localAddress = '127.0.0.1';
    let localPort: number | undefined;

    if (config.sshTunnel?.enabled) {
      log.info(`Establishing SSH tunnel to ${config.sshTunnel.host}:${config.sshTunnel.port}`);
      sshTunnelService = new SshTunnelService();
      
      const tunnelConfig: SshTunnelConfig = {
        host: config.sshTunnel.host,
        port: config.sshTunnel.port,
        username: config.sshTunnel.username,
        password: config.sshTunnel.password,
        privateKey: config.sshTunnel.privateKey,
        passphrase: config.sshTunnel.passphrase,
        remoteHost: config.sshTunnel.remoteHost,
        remotePort: config.sshTunnel.remotePort,
      };

      localPort = await sshTunnelService.connect(tunnelConfig);
      log.info(`SSH tunnel established on local port ${localPort}`);
    }

    log.info(`Connecting to ZooKeeper: ${config.connectionString}`);
    zkService = new ZkService({
      connectionString: config.connectionString,
      localAddress,
      localPort,
    });
    await zkService.connect();
    mainWindow?.webContents.send('zk:connected');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Connection failed: ${message}`);
    return { success: false, error: message };
  }
});

ipcMain.handle('zk:disconnect', async () => {
  try {
    if (zkService) {
      await zkService.disconnect();
      zkService = null;
    }
    if (sshTunnelService) {
      await sshTunnelService.disconnect();
      sshTunnelService = null;
    }
    mainWindow?.webContents.send('zk:disconnected');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle('zk:getChildren', async (_event, nodePath: string) => {
  try {
    if (!zkService) throw new Error('Not connected');
    const children = await zkService.getChildren(nodePath);
    return { success: true, children };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle('zk:getNode', async (_event, nodePath: string) => {
  try {
    if (!zkService) throw new Error('Not connected');
    const node = await zkService.getNode(nodePath);
    return { success: true, node };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle('zk:createNode', async (_event, nodePath: string, data: string, ephemeral: boolean, sequential: boolean) => {
  try {
    if (!zkService) throw new Error('Not connected');
    const result = await zkService.createNode(nodePath, data, ephemeral, sequential);
    return { success: true, path: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle('zk:setNodeData', async (_event, nodePath: string, data: string) => {
  try {
    if (!zkService) throw new Error('Not connected');
    await zkService.setData(nodePath, data);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle('zk:deleteNode', async (_event, nodePath: string) => {
  try {
    if (!zkService) throw new Error('Not connected');
    await zkService.deleteNode(nodePath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});

ipcMain.handle('dialog:showMessage', async (_event, options: Electron.MessageBoxOptions) => {
  if (!mainWindow) return { response: 0 };
  return dialog.showMessageBox(mainWindow, options);
});

app.whenReady().then(() => {
  log.info('App ready, creating window');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', `Uncaught exception: ${error.message}`);
  process.exit(1);
});
