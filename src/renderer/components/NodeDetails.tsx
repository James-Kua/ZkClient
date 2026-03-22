import { useState, useMemo } from 'react';
import { FiEdit2, FiTrash2, FiRefreshCw, FiClock, FiHash, FiLayers, FiCopy, FiCheck } from 'react-icons/fi';
import { ZkNode } from '../types';

interface Props {
  node: ZkNode;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

function NodeDetails({ node, onEdit, onDelete, onRefresh }: Props) {
  const [copied, setCopied] = useState(false);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const isJson = useMemo(() => {
    if (!node.data.trim()) return false;
    try {
      JSON.parse(node.data);
      return true;
    } catch {
      return false;
    }
  }, [node.data]);

  const displayData = useMemo(() => {
    if (!node.data.trim()) return '';
    if (isJson) {
      return JSON.stringify(JSON.parse(node.data), null, 2);
    }
    return node.data;
  }, [node.data, isJson]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isEphemeral = node.stat.ephemeralOwner !== '0';

  return (
    <div className="node-details">
      <div className="details-header">
        <h2>Node Details</h2>
        <div className="details-actions">
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <FiRefreshCw /> Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>
            <FiEdit2 /> Edit
          </button>
          {node.path !== '/' && (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              <FiTrash2 /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="details-path">
        <code>{node.path}</code>
        {isEphemeral && <span className="badge badge-warning">Ephemeral</span>}
        {isJson && <span className="badge badge-info">JSON</span>}
      </div>

      <div className="details-section">
        <div className="data-header">
          <h3>Data</h3>
          {node.data && (
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? <FiCheck /> : <FiCopy />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
        <pre className="data-preview">
          {displayData || <em className="text-muted">(empty)</em>}
        </pre>
      </div>

      <div className="details-section">
        <h3>Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <FiHash />
            <span className="stat-label">Version</span>
            <span className="stat-value">{node.stat.version}</span>
          </div>
          <div className="stat-item">
            <FiLayers />
            <span className="stat-label">Children</span>
            <span className="stat-value">{node.stat.numChildren}</span>
          </div>
          <div className="stat-item">
            <FiClock />
            <span className="stat-label">Created</span>
            <span className="stat-value">{formatDate(node.stat.ctime)}</span>
          </div>
          <div className="stat-item">
            <FiClock />
            <span className="stat-label">Modified</span>
            <span className="stat-value">{formatDate(node.stat.mtime)}</span>
          </div>
        </div>
      </div>

      <div className="details-section">
        <h3>Advanced</h3>
        <table className="stats-table">
          <tbody>
            <tr>
              <td>CZXID (Created)</td>
              <td><code>{node.stat.czxid}</code></td>
            </tr>
            <tr>
              <td>MZXID (Modified)</td>
              <td><code>{node.stat.mzxid}</code></td>
            </tr>
            <tr>
              <td>PZXID</td>
              <td><code>{node.stat.pzxid}</code></td>
            </tr>
            <tr>
              <td>Data Length</td>
              <td><code>{node.stat.dataLength}</code> bytes</td>
            </tr>
            <tr>
              <td>Cversion (Children)</td>
              <td><code>{node.stat.cversion}</code></td>
            </tr>
            <tr>
              <td>Aversion (ACL)</td>
              <td><code>{node.stat.aversion}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default NodeDetails;
