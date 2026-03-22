import { Client, ConnectConfig } from 'ssh2';
import * as net from 'net';
import log from 'electron-log';

export interface SshTunnelConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remoteHost: string;
  remotePort: number;
}

export class SshTunnelService {
  private client: Client | null = null;
  private server: net.Server | null = null;
  private localPort: number = 0;
  private config: SshTunnelConfig | null = null;

  async connect(config: SshTunnelConfig): Promise<number> {
    return new Promise((resolve, reject) => {
      this.config = config;
      this.client = new Client();

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
      };

      if (config.password) {
        connectConfig.password = config.password;
      }

      if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase;
        }
      }

      this.client.on('ready', () => {
        log.info('SSH connection established');

        this.server = net.createServer((socket) => {
          log.info('New connection to local port');

          this.client?.forwardOut(
            socket.remoteAddress || '127.0.0.1',
            socket.remotePort || 0,
            config.remoteHost,
            config.remotePort,
            (err, stream) => {
              if (err) {
                log.error('Forward error:', err);
                socket.end();
                return;
              }

              socket.pipe(stream).pipe(socket);
            }
          );
        });

        this.server.listen(0, '127.0.0.1', () => {
          const address = this.server?.address() as net.AddressInfo;
          this.localPort = address.port;
          log.info(`SSH tunnel listening on port ${this.localPort}`);
          resolve(this.localPort);
        });

        this.server.on('error', (err) => {
          log.error('Local server error:', err);
          reject(err);
        });
      });

      this.client.on('error', (err) => {
        log.error('SSH connection error:', err);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      this.client.connect(connectConfig);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          log.info('Local server closed');
          this.server = null;
        });
      }

      if (this.client) {
        this.client.end();
        this.client = null;
        log.info('SSH tunnel disconnected');
      }

      this.localPort = 0;
      resolve();
    });
  }

  getLocalPort(): number {
    return this.localPort;
  }

  isConnected(): boolean {
    return this.client !== null && this.localPort > 0;
  }
}