import * as Backend from '../wailsjs/go/main/App';
import type { main } from '../wailsjs/go/models';
import { ClipboardSetText, EventsOn } from '../wailsjs/runtime/runtime';
import type { ChildInfo, ConnectionConfig, ZkNode } from './types';

// Thin typed wrapper over the generated Wails bindings. Backend errors reject
// the promise with a plain string; errorMessage() normalises that.
export const api = {
  connect: (config: ConnectionConfig) => Backend.Connect(config as main.ConnectionConfig),
  disconnect: () => Backend.Disconnect(),
  getChildren: (path: string) => Backend.GetChildren(path) as Promise<ChildInfo[]>,
  getNode: (path: string) => Backend.GetNode(path) as Promise<ZkNode>,
  createNode: (path: string, data: string, ephemeral: boolean, sequential: boolean) =>
    Backend.CreateNode(path, data, ephemeral, sequential),
  setNodeData: (path: string, data: string, version: number) => Backend.SetNodeData(path, data, version),
  deleteNode: (path: string, recursive: boolean) => Backend.DeleteNode(path, recursive),
  copy: (text: string) => ClipboardSetText(text),
  onConnectionChange: (cb: (connected: boolean) => void) => {
    const offConnected = EventsOn('zk:connected', () => cb(true));
    const offDisconnected = EventsOn('zk:disconnected', () => cb(false));
    return () => {
      offConnected();
      offDisconnected();
    };
  },
};

export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  return String(e);
}

export function joinPath(parent: string, name: string): string {
  return parent === '/' ? `/${name}` : `${parent}/${name}`;
}

export function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i <= 0 ? '/' : path.slice(0, i);
}
