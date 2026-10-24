import { useCallback, useEffect, useRef, useState } from 'react';
import { FiLogOut, FiPlus, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import { api, errorMessage, parentOf } from './api';
import ConnectScreen from './components/ConnectScreen';
import Logo from './components/Logo';
import { CreateNodeDialog, DeleteNodeDialog } from './components/NodeDialogs';
import NodePanel from './components/NodePanel';
import { useToast } from './components/Toasts';
import Tree from './components/Tree';
import type { ChildInfo, ConnectionConfig, ConnectionStatus, ZkNode } from './types';

const SIDEBAR_KEY = 'zkclient.sidebarWidth';

type DialogState = { kind: 'create'; parent: string } | { kind: 'delete'; node: ZkNode } | null;

function readSidebarWidth() {
  try {
    return Number(localStorage.getItem(SIDEBAR_KEY)) || 300;
  } catch {
    return 300;
  }
}

export default function App() {
  const toast = useToast();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [server, setServer] = useState('');
  const [childrenByPath, setChildrenByPath] = useState<Record<string, ChildInfo[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['/']));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ZkNode | null>(null);
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const filterRef = useRef<HTMLInputElement>(null);

  // Latest values for async callbacks that shouldn't be re-created on every change.
  const latest = useRef({ status, expanded, childrenByPath, selectedPath });
  latest.current = { status, expanded, childrenByPath, selectedPath };

  const setFlag = (setter: typeof setLoading, path: string, on: boolean) =>
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(path);
      else next.delete(path);
      return next;
    });

  const loadChildren = useCallback(async (path: string) => {
    setFlag(setLoading, path, true);
    try {
      const kids = await api.getChildren(path);
      setChildrenByPath((prev) => ({ ...prev, [path]: kids }));
      return true;
    } catch (e) {
      toast('error', errorMessage(e));
      return false;
    } finally {
      setFlag(setLoading, path, false);
    }
  }, [toast]);

  // After a create/delete under `path`, its own child list changes and so does
  // its child count, which lives in the grandparent's list.
  const reloadAround = async (path: string) => {
    const grandparent = parentOf(path);
    await Promise.all([
      loadChildren(path),
      path !== '/' && latest.current.childrenByPath[grandparent] ? loadChildren(grandparent) : null,
    ]);
  };

  const selectNode = useCallback(async (path: string) => {
    setSelectedPath(path);
    try {
      const node = await api.getNode(path);
      if (latest.current.selectedPath === path) setSelectedNode(node);
    } catch (e) {
      if (latest.current.selectedPath === path) {
        setSelectedNode(null);
        toast('error', errorMessage(e));
      }
    }
  }, [toast]);

  const toggle = useCallback((path: string, open?: boolean) => {
    const isOpen = latest.current.expanded.has(path);
    const shouldOpen = open ?? !isOpen;
    if (shouldOpen === isOpen) return;
    setFlag(setExpanded, path, shouldOpen);
    if (shouldOpen && !latest.current.childrenByPath[path]) loadChildren(path);
  }, [loadChildren]);

  // Reloads every expanded branch and the selected node; collapsed branches are
  // dropped from the cache so they're fetched fresh next time.
  const refresh = useCallback(async () => {
    const { expanded, childrenByPath, selectedPath } = latest.current;
    const paths = ['/', ...[...expanded].filter((p) => p !== '/' && childrenByPath[p])];
    const results = await Promise.all(paths.map((p) => api.getChildren(p).then((kids) => [p, kids] as const, () => null)));
    setChildrenByPath(Object.fromEntries(results.filter((r) => r !== null)));
    if (selectedPath) selectNode(selectedPath);
  }, [selectNode]);

  const reset = () => {
    setChildrenByPath({});
    setExpanded(new Set(['/']));
    setSelectedPath(null);
    setSelectedNode(null);
    setFilter('');
    setDialog(null);
  };

  const connect = async (config: ConnectionConfig) => {
    await api.connect(config);
    reset();
    setServer(config.sshTunnel?.enabled ? `${config.connectionString} via ${config.sshTunnel.host}` : config.connectionString);
    setStatus('connected');
    await loadChildren('/');
    selectNode('/');
  };

  const disconnect = async () => {
    await api.disconnect();
    setStatus('disconnected');
    reset();
  };

  useEffect(
    () =>
      api.onConnectionChange((connected) => {
        const prev = latest.current.status;
        if (prev === 'disconnected') return;
        if (!connected) setStatus('reconnecting');
        else if (prev === 'reconnecting') {
          setStatus('connected');
          refresh();
        }
      }),
    [refresh],
  );

  useEffect(() => {
    if (status === 'disconnected') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || dialog) return;
      if (e.key === 'r') refresh();
      else if (e.key === 'f') filterRef.current?.focus();
      else if (e.key === 'n') setDialog({ kind: 'create', parent: latest.current.selectedPath ?? '/' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, dialog, refresh]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    let width = startW;
    const onMove = (ev: MouseEvent) => {
      width = Math.min(560, Math.max(220, startW + ev.clientX - startX));
      setSidebarWidth(width);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.classList.remove('resizing');
      try {
        localStorage.setItem(SIDEBAR_KEY, String(width));
      } catch {
        // ignore
      }
    };
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (status === 'disconnected') {
    return <ConnectScreen onConnect={connect} />;
  }

  return (
    <div className="app">
      <header className="titlebar">
        <div className="titlebar-brand">
          <Logo />
          <span>ZkClient</span>
        </div>
        <div className={`server-pill ${status}`}>
          <span className="dot" />
          <span className="mono">{server}</span>
          {status === 'reconnecting' && <span className="muted">reconnecting…</span>}
        </div>
        <button className="btn btn-ghost sm no-drag" onClick={disconnect}>
          <FiLogOut /> Disconnect
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-toolbar">
            <div className="search">
              <FiSearch />
              <input
                ref={filterRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
                placeholder="Filter loaded nodes"
                spellCheck={false}
              />
              {filter ? (
                <button className="icon-btn subtle" onClick={() => setFilter('')} aria-label="Clear filter">
                  <FiX />
                </button>
              ) : (
                <kbd>⌘F</kbd>
              )}
            </div>
            <button className="icon-btn" onClick={() => setDialog({ kind: 'create', parent: selectedPath ?? '/' })} title="New node (⌘N)">
              <FiPlus />
            </button>
            <button className="icon-btn" onClick={refresh} title="Refresh (⌘R)">
              <FiRefreshCw />
            </button>
          </div>
          <Tree
            childrenByPath={childrenByPath}
            expanded={expanded}
            loading={loading}
            selectedPath={selectedPath}
            filter={filter}
            onSelect={selectNode}
            onToggle={toggle}
          />
          <div className="resizer" onMouseDown={startResize} />
        </aside>

        <main className="content">
          {selectedNode ? (
            <NodePanel
              node={selectedNode}
              onNavigate={selectNode}
              onRefresh={() => selectNode(selectedNode.path)}
              onCreateChild={() => setDialog({ kind: 'create', parent: selectedNode.path })}
              onDelete={() => setDialog({ kind: 'delete', node: selectedNode })}
              onSaved={() => selectNode(selectedNode.path)}
            />
          ) : (
            <div className="empty-state">
              <p>Select a node to inspect it</p>
              <small>Use ↑ ↓ to move and ← → to collapse or expand</small>
            </div>
          )}
        </main>
      </div>

      {dialog?.kind === 'create' && (
        <CreateNodeDialog
          parentPath={dialog.parent}
          onClose={() => setDialog(null)}
          onCreated={async (path) => {
            setDialog(null);
            toast('success', `Created ${path}`);
            const parent = parentOf(path);
            await reloadAround(parent);
            setFlag(setExpanded, parent, true);
            selectNode(path);
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteNodeDialog
          path={dialog.node.path}
          numChildren={dialog.node.stat.numChildren}
          onClose={() => setDialog(null)}
          onDeleted={async () => {
            const { path } = dialog.node;
            setDialog(null);
            toast('success', `Deleted ${path}`);
            setChildrenByPath((prev) => Object.fromEntries(Object.entries(prev).filter(([p]) => p !== path && !p.startsWith(path + '/'))));
            const parent = parentOf(path);
            await reloadAround(parent);
            selectNode(parent);
          }}
        />
      )}
    </div>
  );
}
