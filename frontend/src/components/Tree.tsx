import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { FiChevronRight, FiFileText, FiFolder } from 'react-icons/fi';
import { joinPath, parentOf } from '../api';
import type { ChildInfo } from '../types';

interface Row {
  path: string;
  name: string;
  depth: number;
  numChildren: number;
  expanded: boolean;
  match: boolean;
}

interface Props {
  childrenByPath: Record<string, ChildInfo[]>;
  expanded: Set<string>;
  loading: Set<string>;
  selectedPath: string | null;
  filter: string;
  onSelect: (path: string) => void;
  onToggle: (path: string, open?: boolean) => void;
}

// Flattens the loaded part of the tree into visible rows. With a filter, only
// nodes that match (or have a matching loaded descendant) are shown, and their
// ancestors are force-expanded.
function buildRows(childrenByPath: Record<string, ChildInfo[]>, expanded: Set<string>, filter: string): Row[] {
  const q = filter.trim().toLowerCase();
  const rows: Row[] = [];

  const hasMatch = (path: string, name: string, memo: Map<string, boolean>): boolean => {
    if (memo.has(path)) return memo.get(path)!;
    const result =
      name.toLowerCase().includes(q) ||
      (childrenByPath[path] ?? []).some((c) => hasMatch(joinPath(path, c.name), c.name, memo));
    memo.set(path, result);
    return result;
  };
  const memo = new Map<string, boolean>();

  const walk = (path: string, name: string, depth: number, numChildren: number) => {
    if (q && !hasMatch(path, name, memo)) return;
    const kids = childrenByPath[path];
    const isOpen = q ? !!kids?.length : expanded.has(path);
    rows.push({ path, name, depth, numChildren, expanded: isOpen, match: !!q && name.toLowerCase().includes(q) });
    if (isOpen && kids) {
      for (const c of kids) walk(joinPath(path, c.name), c.name, depth + 1, c.numChildren);
    }
  };

  walk('/', '/', 0, childrenByPath['/']?.length ?? 1);
  return rows;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function Tree({ childrenByPath, expanded, loading, selectedPath, filter, onSelect, onToggle }: Props) {
  const rows = useMemo(() => buildRows(childrenByPath, expanded, filter), [childrenByPath, expanded, filter]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.querySelector('.tree-row.selected')?.scrollIntoView({ block: 'nearest' });
  }, [selectedPath]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (rows.length === 0) return;
    const idx = rows.findIndex((r) => r.path === selectedPath);
    const row = rows[idx];
    switch (e.key) {
      case 'ArrowDown':
        onSelect(rows[Math.min(idx + 1, rows.length - 1)].path);
        break;
      case 'ArrowUp':
        onSelect(rows[Math.max(idx - 1, 0)].path);
        break;
      case 'ArrowRight':
        if (!row) return;
        if (row.numChildren > 0 && !row.expanded) onToggle(row.path, true);
        else if (row.expanded && rows[idx + 1]?.depth > row.depth) onSelect(rows[idx + 1].path);
        break;
      case 'ArrowLeft':
        if (!row) return;
        if (row.expanded && row.path !== '/') onToggle(row.path, false);
        else if (row.path !== '/') onSelect(parentOf(row.path));
        break;
      case 'Enter':
        if (row && row.numChildren > 0) onToggle(row.path);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div className="tree" ref={containerRef} tabIndex={0} onKeyDown={onKeyDown} role="tree">
      {rows.map((row) => {
        const isLoading = loading.has(row.path);
        const isBranch = row.numChildren > 0;
        return (
          <div
            key={row.path}
            role="treeitem"
            aria-expanded={isBranch ? row.expanded : undefined}
            aria-selected={row.path === selectedPath}
            className={`tree-row ${row.path === selectedPath ? 'selected' : ''}`}
            style={{ paddingLeft: 8 + row.depth * 16 }}
            onClick={() => onSelect(row.path)}
            onDoubleClick={() => isBranch && onToggle(row.path)}
            title={row.path}
          >
            {Array.from({ length: row.depth }, (_, i) => (
              <span key={i} className="tree-guide" style={{ left: 15 + i * 16 }} />
            ))}
            <span
              className={`tree-chevron ${row.expanded ? 'open' : ''} ${isBranch ? '' : 'hidden'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isBranch) onToggle(row.path);
              }}
            >
              {isLoading ? <span className="spinner small" /> : <FiChevronRight />}
            </span>
            <span className={`tree-icon ${isBranch ? 'branch' : 'leaf'}`}>{isBranch ? <FiFolder /> : <FiFileText />}</span>
            <span className={`tree-name ${row.path === '/' ? 'root' : ''}`}>
              <Highlight text={row.name} query={row.match ? filter : ''} />
            </span>
            {isBranch && row.path !== '/' && <span className="tree-count">{row.numChildren}</span>}
          </div>
        );
      })}
      {filter && rows.length === 0 && <div className="tree-empty">No loaded nodes match “{filter}”</div>}
    </div>
  );
}
