import { FiChevronRight, FiChevronDown, FiFolder, FiLoader } from 'react-icons/fi';
import { TreeNode } from '../App';

interface Props {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
}

function TreeNodeItem({ node, level, selectedPath, onSelect, onToggleExpand }: {
  node: TreeNode;
  level: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
}) {
  const isSelected = selectedPath === node.path;
  const hasChildren = node.hasChildren || node.children.length > 0;

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect(node.path)}
      >
        <span 
          className="tree-toggle" 
          onClick={(e) => { e.stopPropagation(); onToggleExpand(node.path); }}
        >
          {node.isLoading ? (
            <FiLoader className="spin" />
          ) : hasChildren ? (
            node.isExpanded ? <FiChevronDown /> : <FiChevronRight />
          ) : (
            <span className="tree-toggle-placeholder"></span>
          )}
        </span>
        <span className="tree-icon">
          <FiFolder />
        </span>
        <span className="tree-label" title={node.path}>{node.name}</span>
      </div>
      {node.isExpanded && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({ nodes, selectedPath, onSelect, onToggleExpand }: Props) {
  return (
    <div className="tree-view">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          level={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}

export default TreeView;
