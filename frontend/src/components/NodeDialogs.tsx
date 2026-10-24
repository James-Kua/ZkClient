import { useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { api, errorMessage, joinPath } from '../api';
import Dialog from './Dialog';

interface CreateProps {
  parentPath: string;
  onClose: () => void;
  onCreated: (path: string) => void;
}

export function CreateNodeDialog({ parentPath, onClose, onCreated }: CreateProps) {
  const [parent, setParent] = useState(parentPath);
  const [name, setName] = useState('');
  const [data, setData] = useState('');
  const [ephemeral, setEphemeral] = useState(false);
  const [sequential, setSequential] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanParent = '/' + parent.split('/').filter(Boolean).join('/');
  const fullPath = joinPath(cleanParent, name.replace(/^\/+/, ''));
  const valid = name.trim() !== '' && !name.endsWith('/');

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.createNode(fullPath, data, ephemeral, sequential));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="New node"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid || busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field-row">
          <label className="field grow">
            <span>Parent</span>
            <input className="input mono" value={parent} onChange={(e) => setParent(e.target.value)} spellCheck={false} />
          </label>
          <label className="field grow">
            <span>Name</span>
            <input autoFocus className="input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-node" spellCheck={false} />
          </label>
        </div>
        <div className="path-preview mono">
          {fullPath}
          {sequential && <span className="muted">0000000001</span>}
        </div>
        <label className="field">
          <span>Data <em>optional</em></span>
          <textarea className="input mono" rows={6} value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} />
        </label>
        <div className="toggles">
          <label className="toggle">
            <input type="checkbox" checked={ephemeral} onChange={(e) => setEphemeral(e.target.checked)} />
            <span className={`switch ${ephemeral ? 'on' : ''}`} />
            <span>
              Ephemeral <small>Removed when this session ends</small>
            </span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={sequential} onChange={(e) => setSequential(e.target.checked)} />
            <span className={`switch ${sequential ? 'on' : ''}`} />
            <span>
              Sequential <small>Server appends a 10-digit counter</small>
            </span>
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

interface DeleteProps {
  path: string;
  numChildren: number;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteNodeDialog({ path, numChildren, onClose, onDeleted }: DeleteProps) {
  const [recursive, setRecursive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsRecursive = numChildren > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteNode(path, recursive);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Delete node"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={busy || (needsRecursive && !recursive)} autoFocus>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      <p className="confirm-text">
        Permanently delete <code>{path}</code>?
      </p>
      {needsRecursive && (
        <label className="warning-box">
          <FiAlertTriangle />
          <span>
            This node has {numChildren} {numChildren === 1 ? 'child' : 'children'}.
            <span className="check">
              <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />
              Also delete everything beneath it
            </span>
          </span>
        </label>
      )}
      {error && <div className="form-error">{error}</div>}
    </Dialog>
  );
}
