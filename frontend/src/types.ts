export interface ZkStat {
  czxid: string;
  mzxid: string;
  pzxid: string;
  ctime: number; // unix millis
  mtime: number;
  version: number;
  cversion: number;
  aversion: number;
  ephemeralOwner: string;
  dataLength: number;
  numChildren: number;
}

export interface ZkNode {
  path: string;
  data: string;
  stat: ZkStat;
}

export interface ChildInfo {
  name: string;
  numChildren: number;
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

export type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting';
