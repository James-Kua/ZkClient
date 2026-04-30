import { useState, useEffect } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';

interface Props {
  mode: 'create' | 'edit';
  nodePath: string;
  nodeData: string;
  onClose: () => void;
  onSaved: () => void;
}

function NodeEditor({ mode, nodePath, nodeData, onClose, onSaved }: Props) {
  const [path, setPath] = useState(mode === 'create' ? '/' : nodePath);
  const [data, setData] = useState(nodeData);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [isSequential, setIsSequential] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'create') {
      setPath('/');
      setData('');
      setIsEphemeral(false);
      setIsSequential(false);
    } else {
      setPath(nodePath);
      setData(nodeData);
    }
    setError(null);
  }, [mode, nodePath, nodeData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const result = await window.zkApi.createNode(cleanPath, data, isEphemeral, isSequential);
        if (!result.success) {
          setError(result.error || 'Failed to create node');
          setIsLoading(false);
          return;
        }
      } else {
        const result = await window.zkApi.setNodeData(nodePath, data);
        if (!result.success) {
          setError(result.error || 'Failed to update node');
          setIsLoading(false);
          return;
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
    setIsLoading(false);
  };

  return (
    <div className="ssh-modal-overlay" onClick={onClose}>
      <div className="ssh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Create Node' : 'Edit Node'}</h2>
          <button className="btn-icon" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="path">Path</label>
            <input
              id="path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/my/path"
              disabled={mode === 'edit'}
              required={mode === 'create'}
            />
            {mode === 'create' && (
              <small className="form-hint">
                Path must start with /
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="data">Data</label>
            <textarea
              id="data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="Enter node data..."
              rows={8}
            />
          </div>

          {mode === 'create' && (
            <div className="tile-options">
              <button
                type="button"
                className={`tile-option ${isEphemeral ? 'active' : ''}`}
                onClick={() => setIsEphemeral(!isEphemeral)}
              >
                Ephemeral Node
              </button>
              <button
                type="button"
                className={`tile-option ${isSequential ? 'active' : ''}`}
                onClick={() => setIsSequential(!isSequential)}
              >
                Sequential
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              <FiCheck /> {isLoading ? 'Saving...' : (mode === 'create' ? 'Create' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NodeEditor;
