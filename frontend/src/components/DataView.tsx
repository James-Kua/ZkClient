import { Fragment, useMemo, type ReactNode } from 'react';

export type DataFormat = 'json' | 'properties' | 'text' | 'empty';

export function detectFormat(data: string): DataFormat {
  const trimmed = data.trim();
  if (!trimmed) return 'empty';
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // fall through
    }
  }
  const lines = trimmed.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length > 1 && lines.every((l) => /^\s*[\w.\-]+\s*[=:]/.test(l))) return 'properties';
  return 'text';
}

export function prettyJson(data: string): string {
  return JSON.stringify(JSON.parse(data), null, 2);
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlightJson(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(JSON_TOKEN)) {
    const i = m.index!;
    if (i > last) out.push(line.slice(last, i));
    if (m[1]) {
      out.push(<span key={i} className={m[2] ? 'tok-key' : 'tok-str'}>{m[1]}</span>);
      if (m[2]) out.push(m[2]);
    } else if (m[3]) {
      out.push(<span key={i} className="tok-lit">{m[3]}</span>);
    } else {
      out.push(<span key={i} className="tok-num">{m[4]}</span>);
    }
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function highlightProperties(line: string): ReactNode[] {
  if (line.trim().startsWith('#')) return [<span key="c" className="tok-comment">{line}</span>];
  const m = line.match(/^(\s*[\w.\-]+)(\s*[=:]\s*)(.*)$/);
  if (!m) return [line];
  return [<span key="k" className="tok-key">{m[1]}</span>, m[2], <span key="v" className="tok-str">{m[3]}</span>];
}

interface Props {
  text: string;
  format: DataFormat;
}

export default function DataView({ text, format }: Props) {
  const lines = useMemo(() => text.split('\n'), [text]);
  const highlight = format === 'json' ? highlightJson : format === 'properties' ? highlightProperties : (l: string) => [l];

  return (
    <div className="code">
      <div className="code-gutter" aria-hidden>
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre className="code-body">
        {lines.map((line, i) => (
          <Fragment key={i}>
            {highlight(line)}
            {i < lines.length - 1 ? '\n' : null}
          </Fragment>
        ))}
      </pre>
    </div>
  );
}
