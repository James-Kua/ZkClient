import { useState } from 'react';
import { FiPlus, FiX, FiSettings } from 'react-icons/fi';
import { SshTunnelConfig, ConnectionConfig } from '../types';
import SshTunnelModal from './SshTunnelModal';

interface Props {
  isConnected: boolean;
}

function ConnectionPanel({ isConnected }: Props) {
  const [connectionString, setConnectionString] = useState('localhost:2181');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSshModal, setShowSshModal] = useState(false);
  const [sshConfig, setSshConfig] = useState<SshTunnelConfig | undefined>();

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    const config: ConnectionConfig = {
      connectionString,
      sshTunnel: sshConfig,
    };

    const result = await window.zkApi.connect(config);
    if (!result.success) {
      setError(result.error || 'Connection failed');
    }
    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    await window.zkApi.disconnect();
    setIsLoading(false);
  };

  return (
    <div className="connection-panel">
      {!isConnected ? (
        <>
          <input
            type="text"
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="localhost:2181"
            className="connection-input"
            disabled={isLoading}
          />
          <button
            className="btn btn-icon"
            onClick={() => setShowSshModal(true)}
            title="SSH Tunnel Settings"
          >
            <FiSettings />
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isLoading || !connectionString.trim()}
          >
            <FiPlus /> Connect
          </button>
          {error && <span className="error-text">{error}</span>}
          {sshConfig?.enabled && (
            <span className="ssh-badge">SSH</span>
          )}
        </>
      ) : (
        <>
          <span className="connected-status">
            <span className="status-dot connected"></span>
            Connected: {connectionString}
          </span>
          <button
            className="btn btn-danger"
            onClick={handleDisconnect}
            disabled={isLoading}
          >
            <FiX /> Disconnect
          </button>
        </>
      )}
      
      <SshTunnelModal
        isOpen={showSshModal}
        onClose={() => setShowSshModal(false)}
        config={sshConfig}
        onSave={setSshConfig}
      />
    </div>
  );
}

export default ConnectionPanel;