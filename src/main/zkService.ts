import * as zk from 'node-zookeeper-client';
import log from 'electron-log';

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

export interface ZkConnectionOptions {
  connectionString: string;
  localAddress?: string;
  localPort?: number;
}

export class ZkService {
  private client: zk.Client | null = null;
  private connectionString: string;

  constructor(options: ZkConnectionOptions) {
    if (options.localPort && options.localAddress) {
      this.connectionString = `${options.localAddress}:${options.localPort}`;
    } else {
      this.connectionString = options.connectionString;
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.client = zk.createClient(this.connectionString, {
        sessionTimeout: 30000,
        spinDelay: 1000,
      });

      this.client.on('connected', () => {
        log.info('ZooKeeper connected');
        resolve();
      });

      this.client.on('state', (state: zk.State) => {
        if (state === zk.State.DISCONNECTED) {
          log.info('ZooKeeper disconnected');
        }
      });

      this.client.connect();
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.close();
        this.client = null;
      }
      resolve();
    });
  }

  async getChildren(nodePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected'));
        return;
      }

      this.client.getChildren(nodePath, (error, children) => {
        if (error) {
          log.error(`getChildren error for ${nodePath}:`, error);
          reject(new Error(String(error)));
        } else {
          resolve(children.sort());
        }
      });
    });
  }

  async getNode(nodePath: string): Promise<ZkNode> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected'));
        return;
      }

      this.client.getData(nodePath, (error, data, stat) => {
        if (error) {
          log.error(`getNode error for ${nodePath}:`, error);
          reject(new Error(String(error)));
        } else {
          const statObj = stat as zk.Stat;
          const parseTime = (val: Buffer | number): string => {
            try {
              if (Buffer.isBuffer(val)) {
                const num = Number(val.readBigUInt64BE());
                return new Date(num).toISOString();
              }
              return new Date(Number(val)).toISOString();
            } catch {
              return new Date().toISOString();
            }
          };
          resolve({
            path: nodePath,
            data: data ? data.toString('utf-8') : '',
            stat: {
              czxid: statObj.czxid.toString(),
              mzxid: statObj.mzxid.toString(),
              ctime: parseTime(statObj.ctime),
              mtime: parseTime(statObj.mtime),
              version: statObj.version,
              cversion: statObj.cversion,
              aversion: statObj.aversion,
              ephemeralOwner: statObj.ephemeralOwner.toString(),
              dataLength: statObj.dataLength,
              numChildren: statObj.numChildren,
              pzxid: statObj.pzxid.toString(),
            },
          });
        }
      });
    });
  }

  async createNode(nodePath: string, data: string, ephemeral: boolean = false, sequential: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected'));
        return;
      }

      let flags = zk.CreateMode.PERSISTENT;
      if (ephemeral && sequential) {
        flags = zk.CreateMode.EPHEMERAL_SEQUENTIAL;
      } else if (ephemeral) {
        flags = zk.CreateMode.EPHEMERAL;
      } else if (sequential) {
        flags = zk.CreateMode.PERSISTENT_SEQUENTIAL;
      }

      const dataBuffer = Buffer.from(data, 'utf-8');

      this.client.create(nodePath, dataBuffer, flags, (error, path) => {
        if (error) {
          log.error(`createNode error for ${nodePath}:`, error);
          reject(new Error(String(error)));
        } else {
          resolve(path);
        }
      });
    });
  }

  async setData(nodePath: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected'));
        return;
      }

      const dataBuffer = Buffer.from(data, 'utf-8');

      this.client.setData(nodePath, dataBuffer, (error) => {
        if (error) {
          log.error(`setData error for ${nodePath}:`, error);
          reject(new Error(String(error)));
        } else {
          resolve();
        }
      });
    });
  }

  async deleteNode(nodePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected'));
        return;
      }

      this.client.remove(nodePath, (error) => {
        if (error) {
          log.error(`deleteNode error for ${nodePath}:`, error);
          reject(new Error(String(error)));
        } else {
          resolve();
        }
      });
    });
  }
}
