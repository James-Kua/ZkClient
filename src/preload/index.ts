import { contextBridge, ipcRenderer } from 'electron';

export interface ZkNode {
  path: string;
  data: string;
  stat: {
    czxid: string;
    mzxid: string;
    ctime: string;
    mtime: string;
    version: number;
    cversion: number;
    aversion: number;
    ephemeralOwner: string;
    dataLength: number;
    numChildren: number;
    pzxid: string;
  };
  children?: string[];
}

export interface ApiResult<T = void> {
  success: boolean;
  error?: string;
  node?: ZkNode;
  children?: string[];
  path?: string;
}

export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remoteHost: string;
  remotePort: number;
}

export interface ConnectionConfig {
  connectionString: string;
  sshTunnel?: SshTunnelConfig;
}

const api = {
  connect: (config: ConnectionConfig): Promise<ApiResult> =>
    ipcRenderer.invoke('zk:connect', config),
  disconnect: (): Promise<ApiResult> =>
    ipcRenderer.invoke('zk:disconnect'),
  getChildren: (nodePath: string): Promise<ApiResult<string[]>> =>
    ipcRenderer.invoke('zk:getChildren', nodePath),
  getNode: (nodePath: string): Promise<ApiResult<ZkNode>> =>
    ipcRenderer.invoke('zk:getNode', nodePath),
  createNode: (nodePath: string, data: string, ephemeral: boolean, sequential: boolean): Promise<ApiResult> =>
    ipcRenderer.invoke('zk:createNode', nodePath, data, ephemeral, sequential),
  setNodeData: (nodePath: string, data: string): Promise<ApiResult> =>
    ipcRenderer.invoke('zk:setNodeData', nodePath, data),
  deleteNode: (nodePath: string): Promise<ApiResult> =>
    ipcRenderer.invoke('zk:deleteNode', nodePath),
  showMessage: (options: { type?: string; title?: string; message: string; buttons?: string[] }): Promise<{ response: number }> =>
    ipcRenderer.invoke('dialog:showMessage', options),
  onConnected: (callback: () => void) => {
    ipcRenderer.on('zk:connected', callback);
    return () => ipcRenderer.removeListener('zk:connected', callback);
  },
  onDisconnected: (callback: () => void) => {
    ipcRenderer.on('zk:disconnected', callback);
    return () => ipcRenderer.removeListener('zk:disconnected', callback);
  },
};

contextBridge.exposeInMainWorld('zkApi', api);

declare global {
  interface Window {
    zkApi: typeof api;
  }
}
