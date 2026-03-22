import { useState, useEffect, useCallback } from 'react';
import ConnectionPanel from './components/ConnectionPanel';
import TreeView from './components/TreeView';
import NodeDetails from './components/NodeDetails';
import NodeEditor from './components/NodeEditor';
import { ZkNode } from './types';

export interface TreeNode {
  path: string;
  name: string;
  hasChildren: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  children: TreeNode[];
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ZkNode | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);

  useEffect(() => {
    const unsubConnected = window.zkApi.onConnected(() => {
      setIsConnected(true);
      loadRootNodes();
    });
    const unsubDisconnected = window.zkApi.onDisconnected(() => {
      setIsConnected(false);
      setTreeNodes([]);
      setSelectedPath(null);
      setSelectedNode(null);
    });
    return () => {
      unsubConnected();
      unsubDisconnected();
    };
  }, []);

  const loadRootNodes = useCallback(async () => {
    try {
      const result = await window.zkApi.getChildren('/');
      if (result.success && result.children) {
        const children = await Promise.all(
          result.children.map(async (childName: string) => {
            const childPath = `/${childName}`;
            const nodeResult = await window.zkApi.getNode(childPath);
            return {
              path: childPath,
              name: childName,
              hasChildren: nodeResult.success && nodeResult.node ? nodeResult.node.stat.numChildren > 0 : false,
              isExpanded: false,
              isLoading: false,
              children: [] as TreeNode[],
            };
          })
        );
        setTreeNodes([{
          path: '/',
          name: '/',
          hasChildren: result.children.length > 0,
          isExpanded: true,
          isLoading: false,
          children,
        }]);
      }
    } catch (error) {
      console.error('Failed to load root nodes:', error);
    }
  }, []);

  const handleToggleExpand = useCallback(async (path: string) => {
    const updateNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          if (!node.isExpanded && node.children.length === 0) {
            return { ...node, isExpanded: true, isLoading: true };
          }
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    };

    setTreeNodes(prev => updateNodes(prev));

    const findNode = (nodes: TreeNode[], path: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children.length > 0) {
          const found = findNode(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(treeNodes, path);
    if (node && !node.isExpanded && node.children.length === 0) {
      try {
        const result = await window.zkApi.getChildren(path);
        if (result.success && result.children) {
          const children = await Promise.all(
            result.children.map(async (childName: string) => {
              const childPath = path === '/' ? `/${childName}` : `${path}/${childName}`;
              try {
                const nodeResult = await window.zkApi.getNode(childPath);
                return {
                  path: childPath,
                  name: childName,
                  hasChildren: nodeResult.success && nodeResult.node ? nodeResult.node.stat.numChildren > 0 : false,
                  isExpanded: false,
                  isLoading: false,
                  children: [] as TreeNode[],
                };
              } catch {
                return {
                  path: childPath,
                  name: childName,
                  hasChildren: false,
                  isExpanded: false,
                  isLoading: false,
                  children: [] as TreeNode[],
                };
              }
            })
          );

          const loadChildren = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(n => {
              if (n.path === path) {
                return { ...n, children, isLoading: false };
              }
              if (n.children.length > 0) {
                return { ...n, children: loadChildren(n.children) };
              }
              return n;
            });
          };

          setTreeNodes(prev => loadChildren(prev));
        }
      } catch (error) {
        console.error('Failed to load children:', error);
        setTreeNodes(prev => updateNodes(prev));
      }
    }
  }, [treeNodes]);

  const handleNodeSelect = useCallback(async (path: string) => {
    setSelectedPath(path);
    try {
      const result = await window.zkApi.getNode(path);
      if (result.success && result.node) {
        setSelectedNode(result.node);
      } else {
        setSelectedNode(null);
      }
    } catch (error) {
      console.error('Failed to get node:', error);
      setSelectedNode(null);
    }
  }, []);

  const handleCreateNode = useCallback(() => {
    setEditMode('create');
    setShowEditor(true);
  }, []);

  const handleEditNode = useCallback(() => {
    if (selectedPath) {
      setEditMode('edit');
      setShowEditor(true);
    }
  }, [selectedPath]);

  const handleDeleteNode = useCallback(async () => {
    if (!selectedPath || selectedPath === '/') return;
    const result = await window.zkApi.showMessage({
      type: 'warning',
      title: 'Delete Node',
      message: `Are you sure you want to delete "${selectedPath}"?`,
      buttons: ['Cancel', 'Delete'],
    });
    if (result.response === 1) {
      const deleteResult = await window.zkApi.deleteNode(selectedPath);
      if (deleteResult.success) {
        setSelectedPath(null);
        setSelectedNode(null);
        loadRootNodes();
      }
    }
  }, [selectedPath]);

  const refreshTree = useCallback(() => {
    loadRootNodes();
  }, [loadRootNodes]);

  return (
    <div className="app">
      <header className="header">
        <h1>ZkClient</h1>
        <ConnectionPanel isConnected={isConnected} />
      </header>
      <main className="main">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>ZooKeeper Tree</h2>
            <div className="sidebar-actions">
              {isConnected && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={handleCreateNode}>
                    + Create
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={refreshTree}>
                    Refresh
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="tree-container">
            {isConnected ? (
              <TreeView
                nodes={treeNodes}
                selectedPath={selectedPath}
                onSelect={handleNodeSelect}
                onToggleExpand={handleToggleExpand}
              />
            ) : (
              <div className="not-connected">
                <p>Connect to a ZooKeeper server to view nodes</p>
              </div>
            )}
          </div>
        </aside>
        <section className="content">
          {selectedNode ? (
            <NodeDetails
              node={selectedNode}
              onEdit={handleEditNode}
              onDelete={handleDeleteNode}
              onRefresh={() => handleNodeSelect(selectedPath!)}
            />
          ) : (
            <div className="no-selection">
              <p>Select a node to view its details</p>
            </div>
          )}
        </section>
      </main>
      {showEditor && (
        <NodeEditor
          mode={editMode}
          nodePath={editMode === 'edit' ? selectedPath || '' : ''}
          nodeData={selectedNode?.data || ''}
          onClose={() => setShowEditor(false)}
          onSaved={() => {
            setShowEditor(false);
            loadRootNodes();
            if (selectedPath) handleNodeSelect(selectedPath);
          }}
        />
      )}
    </div>
  );
}

export default App;
