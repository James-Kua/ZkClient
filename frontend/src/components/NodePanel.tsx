import { useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiCopy, FiEdit2, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { api, errorMessage } from '../api';
import type { ZkNode } from '../types';
import DataView, { detectFormat, prettyJson } from './DataView';
import { useToast } from './Toasts';

interface Props {
  node: ZkNode;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onCreateChild: () => void;
  onDelete: () => void;
  onSaved: () => void;
}

const FORMAT_LABEL = { json: 'JSON', properties: 'Properties', text: 'Text', empty: 'Empty' } as const;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function relativeTime(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [2592000, 'month'], [31536000, 'year']];
  let [div, unit] = units[0];
  for (const u of units) if (s >= u[0]) [div, unit] = u;
  const v = Math.floor(s / div);
  return `${v} ${unit}${v === 1 ? '' : 's'} ago`;
}

function sessionHex(owner: string) {
  try {
    return '0x' + BigInt(owner).toString(16);
  } catch {
    return owner;
  }
}

function Breadcrumbs({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split('/').filter(Boolean);
  return (
    <nav className="breadcrumbs mono">
      <button onClick={() => onNavigate('/')}>/</button>
      {parts.map((p, i) => {
        const target = '/' + parts.slice(0, i + 1).join('/');
        const last = i === parts.length - 1;
        return (
          <span key={target} className="crumb">
            {i > 0 && <span className="sep">/</span>}
            {last ? <strong>{p}</strong> : <button onClick={() => onNavigate(target)}>{p}</button>}
          </span>
        );
      })}
    </nav>
  );
}

export default function NodePanel({ node, onNavigate, onRefresh, onCreateChild, onDelete, onSaved }: Props) {
  const toast = useToast();
  const format = useMemo(() => detectFormat(node.data), [node.data]);
  const [raw, setRaw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Leave edit mode when navigating to a different node.
  useEffect(() => {
    setEditing(false);
  }, [node.path]);

  const display = format === 'json' && !raw ? prettyJson(node.data) : node.data;
  const isEphemeral = node.stat.ephemeralOwner !== '0';

  const draftJsonError = useMemo(() => {
    if (!editing || format !== 'json') return null;
    try {
      JSON.parse(draft);
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }, [editing, draft, format]);

  const startEdit = () => {
    setDraft(format === 'json' ? prettyJson(node.data) : node.data);
    setEditing(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.setNodeData(node.path, draft, node.stat.version);
      toast('success', 'Saved');
      setEditing(false);
      onSaved();
    } catch (e) {
      toast('error', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, what: string) => {
    await api.copy(text);
    toast('success', `${what} copied`);
  };

  return (
    <div className="node-panel">
      <header className="node-header">
        <div className="node-title">
          <Breadcrumbs path={node.path} onNavigate={onNavigate} />
          <button className="icon-btn subtle" onClick={() => copy(node.path, 'Path')} title="Copy path">
            <FiCopy />
          </button>
        </div>
        <div className="node-actions">
          <button className="btn btn-ghost" onClick={onRefresh} title="Refresh (⌘R)">
            <FiRefreshCw />
          </button>
          <button className="btn btn-ghost" onClick={onCreateChild}>
            <FiPlus /> Child
          </button>
          {node.path !== '/' && (
            <button className="btn btn-ghost danger" onClick={onDelete}>
              <FiTrash2 /> Delete
            </button>
          )}
        </div>
      </header>

      <div className="node-tags">
        <span className={`tag tag-${format}`}>{FORMAT_LABEL[format]}</span>
        {isEphemeral && <span className="tag tag-ephemeral">Ephemeral</span>}
        <span className="tag">{formatBytes(node.stat.dataLength)}</span>
        <span className="tag">v{node.stat.version}</span>
      </div>

      <section className="card data-card">
        <div className="card-header">
          <h3>Data</h3>
          <div className="card-actions">
            {editing ? (
              <>
                {draftJsonError && <span className="hint warn" title={draftJsonError}>Invalid JSON</span>}
                {format === 'json' && !draftJsonError && (
                  <button className="btn btn-ghost sm" onClick={() => setDraft(prettyJson(draft))}>
                    Format
                  </button>
                )}
                <button className="btn btn-ghost sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary sm" onClick={save} disabled={saving}>
                  <FiCheck /> {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {format === 'json' && (
                  <div className="segmented sm">
                    <button className={!raw ? 'active' : ''} onClick={() => setRaw(false)}>Pretty</button>
                    <button className={raw ? 'active' : ''} onClick={() => setRaw(true)}>Raw</button>
                  </div>
                )}
                {format !== 'empty' && (
                  <button className="btn btn-ghost sm" onClick={() => copy(display, 'Data')}>
                    <FiCopy /> Copy
                  </button>
                )}
                <button className="btn btn-secondary sm" onClick={startEdit}>
                  <FiEdit2 /> Edit
                </button>
              </>
            )}
          </div>
        </div>
        {editing ? (
          <textarea
            ref={editorRef}
            className="editor mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                setEditing(false);
              } else if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: s, selectionEnd: end } = el;
                setDraft(draft.slice(0, s) + '  ' + draft.slice(end));
                requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
              }
            }}
          />
        ) : format === 'empty' ? (
          <div className="data-empty">This node has no data</div>
        ) : (
          <DataView text={display} format={raw ? 'text' : format} />
        )}
      </section>

      <section className="stats">
        <Stat label="Children" value={node.stat.numChildren} />
        <Stat label="Version" value={node.stat.version} />
        <Stat label="Created" value={relativeTime(node.stat.ctime)} title={new Date(node.stat.ctime).toLocaleString()} />
        <Stat label="Modified" value={relativeTime(node.stat.mtime)} title={new Date(node.stat.mtime).toLocaleString()} />
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Stat</h3>
        </div>
        <dl className="kv mono">
          <dt>czxid</dt><dd>{node.stat.czxid}</dd>
          <dt>mzxid</dt><dd>{node.stat.mzxid}</dd>
          <dt>pzxid</dt><dd>{node.stat.pzxid}</dd>
          <dt>ctime</dt><dd>{new Date(node.stat.ctime).toLocaleString()}</dd>
          <dt>mtime</dt><dd>{new Date(node.stat.mtime).toLocaleString()}</dd>
          <dt>cversion</dt><dd>{node.stat.cversion}</dd>
          <dt>aversion</dt><dd>{node.stat.aversion}</dd>
          <dt>dataLength</dt><dd>{node.stat.dataLength}</dd>
          <dt>ephemeralOwner</dt><dd>{isEphemeral ? sessionHex(node.stat.ephemeralOwner) : '—'}</dd>
        </dl>
      </section>
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="stat" title={title}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
