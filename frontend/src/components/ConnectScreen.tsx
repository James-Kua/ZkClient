import { useState } from 'react';
import { FiClock, FiLock, FiTrash2 } from 'react-icons/fi';
import { errorMessage } from '../api';
import type { ConnectionConfig, SshTunnelConfig } from '../types';
import Logo from './Logo';

const RECENT_KEY = 'zkclient.recent';

// Secrets are never persisted; only the shape of the connection is remembered.
type RecentConnection = Pick<ConnectionConfig, 'connectionString'> & {
  ssh?: Omit<SshTunnelConfig, 'password' | 'privateKey' | 'passphrase'>;
};

function loadRecent(): RecentConnection[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(list: RecentConnection[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable; recents are a convenience only
  }
}

const recentKey = (r: RecentConnection) =>
  r.ssh?.enabled ? `${r.connectionString}|${r.ssh.username}@${r.ssh.host}:${r.ssh.port}` : r.connectionString;

const emptySsh: SshTunnelConfig = {
  enabled: false,
  host: '',
  port: 22,
  username: '',
  remoteHost: 'localhost',
  remotePort: 2181,
};

interface Props {
  onConnect: (config: ConnectionConfig) => Promise<void>;
}

export default function ConnectScreen({ onConnect }: Props) {
  const [recent, setRecent] = useState(loadRecent);
  const [connectionString, setConnectionString] = useState(recent[0]?.connectionString ?? 'localhost:2181');
  const [ssh, setSsh] = useState<SshTunnelConfig>({ ...emptySsh, ...recent[0]?.ssh });
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSsh = (patch: Partial<SshTunnelConfig>) => setSsh((s) => ({ ...s, ...patch }));

  const sshIncomplete =
    ssh.enabled && (!ssh.host || !ssh.username || (authMethod === 'password' ? !ssh.password : !ssh.privateKey));

  const connect = async () => {
    setBusy(true);
    setError(null);
    const tunnel: SshTunnelConfig | undefined = ssh.enabled
      ? {
          ...ssh,
          password: authMethod === 'password' ? ssh.password : undefined,
          privateKey: authMethod === 'key' ? ssh.privateKey : undefined,
          passphrase: authMethod === 'key' ? ssh.passphrase : undefined,
        }
      : undefined;
    try {
      await onConnect({ connectionString: connectionString.trim(), sshTunnel: tunnel });
      const { password: _p, privateKey: _k, passphrase: _pp, ...sshShape } = ssh;
      const entry: RecentConnection = { connectionString: connectionString.trim(), ssh: ssh.enabled ? sshShape : undefined };
      const next = [entry, ...recent.filter((r) => recentKey(r) !== recentKey(entry))].slice(0, 6);
      saveRecent(next);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const pickRecent = (r: RecentConnection) => {
    setConnectionString(r.connectionString);
    setSsh({ ...emptySsh, ...r.ssh });
    setError(null);
  };

  const removeRecent = (r: RecentConnection) => {
    const next = recent.filter((x) => recentKey(x) !== recentKey(r));
    setRecent(next);
    saveRecent(next);
  };

  return (
    <div className="connect-screen">
      <div className="titlebar-drag" />
      <div className="connect-card">
        <div className="connect-brand">
          <Logo size={44} />
          <div>
            <h1>ZkClient</h1>
            <p>Connect to a ZooKeeper ensemble</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && connectionString.trim() && !sshIncomplete) connect();
          }}
        >
          <label className="field">
            <span>Connection string</span>
            <input
              autoFocus
              className="input mono"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="localhost:2181"
              disabled={busy}
              spellCheck={false}
            />
            <small>host:port[,host:port…][/chroot]</small>
          </label>

          <div className={`ssh-section ${ssh.enabled ? 'open' : ''}`}>
            <button type="button" className="ssh-toggle" onClick={() => updateSsh({ enabled: !ssh.enabled })}>
              <FiLock />
              <span>SSH tunnel</span>
              <span className={`switch ${ssh.enabled ? 'on' : ''}`} aria-hidden />
            </button>

            {ssh.enabled && (
              <div className="ssh-fields">
                <div className="field-row">
                  <label className="field grow">
                    <span>SSH host</span>
                    <input className="input" value={ssh.host} onChange={(e) => updateSsh({ host: e.target.value })} placeholder="bastion.example.com" />
                  </label>
                  <label className="field port">
                    <span>Port</span>
                    <input className="input" type="number" value={ssh.port} onChange={(e) => updateSsh({ port: Number(e.target.value) })} />
                  </label>
                </div>
                <label className="field">
                  <span>Username</span>
                  <input className="input" value={ssh.username} onChange={(e) => updateSsh({ username: e.target.value })} placeholder="ubuntu" />
                </label>

                <div className="segmented" role="tablist">
                  <button type="button" className={authMethod === 'password' ? 'active' : ''} onClick={() => setAuthMethod('password')}>
                    Password
                  </button>
                  <button type="button" className={authMethod === 'key' ? 'active' : ''} onClick={() => setAuthMethod('key')}>
                    Private key
                  </button>
                </div>

                {authMethod === 'password' ? (
                  <label className="field">
                    <span>Password</span>
                    <input className="input" type="password" value={ssh.password ?? ''} onChange={(e) => updateSsh({ password: e.target.value })} />
                  </label>
                ) : (
                  <>
                    <label className="field">
                      <span>Private key</span>
                      <textarea
                        className="input mono key-input"
                        value={ssh.privateKey ?? ''}
                        onChange={(e) => updateSsh({ privateKey: e.target.value })}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                        spellCheck={false}
                      />
                    </label>
                    <label className="field">
                      <span>Passphrase <em>optional</em></span>
                      <input className="input" type="password" value={ssh.passphrase ?? ''} onChange={(e) => updateSsh({ passphrase: e.target.value })} />
                    </label>
                  </>
                )}

                <div className="field-row">
                  <label className="field grow">
                    <span>ZooKeeper host (from SSH server)</span>
                    <input className="input" value={ssh.remoteHost} onChange={(e) => updateSsh({ remoteHost: e.target.value })} />
                  </label>
                  <label className="field port">
                    <span>Port</span>
                    <input className="input" type="number" value={ssh.remotePort} onChange={(e) => updateSsh({ remotePort: Number(e.target.value) })} />
                  </label>
                </div>
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !connectionString.trim() || sshIncomplete}>
            {busy ? <span className="spinner" /> : null}
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </form>

        {recent.length > 0 && (
          <div className="recent">
            <div className="recent-title">
              <FiClock /> Recent
            </div>
            {recent.map((r) => (
              <div key={recentKey(r)} className="recent-item" onClick={() => pickRecent(r)}>
                <span className="mono">{r.connectionString}</span>
                {r.ssh?.enabled && <span className="tag">via {r.ssh.host}</span>}
                <button
                  className="icon-btn subtle"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecent(r);
                  }}
                  aria-label="Forget"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
