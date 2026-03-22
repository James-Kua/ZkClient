import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { SshTunnelConfig } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: SshTunnelConfig | undefined;
  onSave: (config: SshTunnelConfig) => void;
}

function SshTunnelModal({ isOpen, onClose, config, onSave }: Props) {
  const [enabled, setEnabled] = useState(config?.enabled || false);
  const [host, setHost] = useState(config?.host || '');
  const [port, setPort] = useState(config?.port?.toString() || '22');
  const [username, setUsername] = useState(config?.username || '');
  const [password, setPassword] = useState(config?.password || '');
  const [privateKey, setPrivateKey] = useState(config?.privateKey || '');
  const [passphrase, setPassphrase] = useState(config?.passphrase || '');
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(config?.privateKey ? 'privateKey' : 'password');
  const [remoteHost, setRemoteHost] = useState(config?.remoteHost || 'localhost');
  const [remotePort, setRemotePort] = useState(config?.remotePort?.toString() || '2181');

  const handleSave = () => {
    const sshConfig: SshTunnelConfig = {
      enabled,
      host,
      port: parseInt(port, 10),
      username,
      password: authMethod === 'password' ? password : undefined,
      privateKey: authMethod === 'privateKey' ? privateKey : undefined,
      passphrase: authMethod === 'privateKey' ? passphrase : undefined,
      remoteHost,
      remotePort: parseInt(remotePort, 10),
    };
    onSave(sshConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>SSH Tunnel Settings</h2>
          <button className="btn-icon" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enable SSH Tunnel
            </label>
          </div>

          {enabled && (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label htmlFor="sshHost">SSH Host</label>
                  <input
                    id="sshHost"
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="example.com"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="sshPort">SSH Port</label>
                  <input
                    id="sshPort"
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="22"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="sshUsername">Username</label>
                <input
                  id="sshUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="user"
                />
              </div>

              <div className="form-group">
                <label>Authentication Method</label>
                <div className="auth-method">
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="authMethod"
                      value="password"
                      checked={authMethod === 'password'}
                      onChange={() => setAuthMethod('password')}
                    />
                    Password
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="authMethod"
                      value="privateKey"
                      checked={authMethod === 'privateKey'}
                      onChange={() => setAuthMethod('privateKey')}
                    />
                    Private Key
                  </label>
                </div>
              </div>

              {authMethod === 'password' ? (
                <div className="form-group">
                  <label htmlFor="sshPassword">Password</label>
                  <input
                    id="sshPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="sshPrivateKey">Private Key</label>
                    <textarea
                      id="sshPrivateKey"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder="Paste private key here..."
                      className="ssh-key"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sshPassphrase">Passphrase (optional)</label>
                    <input
                      id="sshPassphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Passphrase"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Remote ZooKeeper Address</label>
                <div className="form-row">
                  <input
                    type="text"
                    value={remoteHost}
                    onChange={(e) => setRemoteHost(e.target.value)}
                    placeholder="localhost"
                    style={{ flex: 2 }}
                  />
                  <input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(e.target.value)}
                    placeholder="2181"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={enabled && (!host || !username || (authMethod === 'password' ? !password : !privateKey))}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SshTunnelModal;