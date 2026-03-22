import { useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';

interface Props {
  isConnected: boolean;
}

function ConnectionPanel({ isConnected }: Props) {
  const [connectionString, setConnectionString] = useState('localhost:2181');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    const result = await window.zkApi.connect(connectionString);
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
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isLoading || !connectionString.trim()}
          >
            <FiPlus /> Connect
          </button>
          {error && <span className="error-text">{error}</span>}
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
    </div>
  );
}

export default ConnectionPanel;
