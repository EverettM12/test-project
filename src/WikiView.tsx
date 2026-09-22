import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { supabase } from './utils/supabase.ts';

export type WikiPage = {
  id: string;
  title: string;
  slug: string;
  content: string;
  parent_id: string | null;
  sort_order: number;
  updated_at: string;
};

type Revision = {
  id: string;
  page_id: string;
  revision_number: number;
  title: string;
  content: string;
  created_at: string;
};

type EditorMode = 'write' | 'split' | 'preview';
type DropPosition = 'before' | 'inside' | 'after';

type WikiViewProps = {
  projectId: string | null;
  pages: WikiPage[];
  selectedId: string | null;
  onSelect: (page: WikiPage | null) => void;
  onCreatePage: (parentId: string | null, title: string) => Promise<WikiPage | null>;
  onSavePage: (page: WikiPage) => Promise<WikiPage | null>;
  onDeletePage: (page: WikiPage) => Promise<boolean>;
  onMovePage: (pageId: string, targetId: string | null, position: DropPosition) => Promise<boolean>;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function WikiView({
  projectId,
  pages,
  selectedId,
  onSelect,
  onCreatePage,
  onSavePage,
  onDeletePage,
  onMovePage,
}: WikiViewProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string | null; position: DropPosition } | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('write');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [childCreateOpen, setChildCreateOpen] = useState(false);
  const [childTitle, setChildTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const selected = pages.find((page) => page.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setDraftTitle('');
      setDraftContent('');
      setRevisions([]);
      return;
    }

    setDraftTitle(selected.title);
    setDraftContent(selected.content.replace(/\\n/g, '\n'));
    setChildCreateOpen(false);
    setChildTitle('');
    setNotice('');

    const ancestors = new Set<string>();
    let currentParentId = selected.parent_id;

    while (currentParentId) {
      ancestors.add(currentParentId);
      const parent = pages.find((page) => page.id === currentParentId);
      currentParentId = parent?.parent_id ?? null;
    }

    setExpandedIds((current) => {
      const next = new Set(current);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
  }, [selectedId, pages]);

  useEffect(() => {
    if (!projectId) return;

    const key = 'test-project:wiki:expanded:' + projectId;
    const stored = localStorage.getItem(key);

    if (!stored) return;

    try {
      const ids = JSON.parse(stored) as string[];
      if (Array.isArray(ids)) setExpandedIds(new Set(ids));
    } catch {
      localStorage.removeItem(key);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    localStorage.setItem(
      'test-project:wiki:expanded:' + projectId,
      JSON.stringify(Array.from(expandedIds)),
    );
  }, [expandedIds, projectId]);

  useEffect(() => {
    if (!selectedId) return;

    window.setTimeout(() => {
      const node = document.querySelector('[data-wiki-node="' + selectedId + '"]');
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }, [selectedId, search]);

  useEffect(() => {
    async function loadHistory() {
      if (!historyOpen || !selectedId) return;

      setHistoryLoading(true);
      setHistoryError('');

      const { data, error } = await supabase
        .from('wiki_page_revisions')
        .select('id,page_id,revision_number,title,content,created_at')
        .eq('page_id', selectedId)
        .order('revision_number', { ascending: false });

      if (error) {
        setHistoryError(error.message);
        setRevisions([]);
      } else {
        setRevisions((data ?? []) as Revision[]);
      }

      setHistoryLoading(false);
    }

    void loadHistory();
  }, [historyOpen, selectedId]);

  const visibleIds = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return null;

    const visible = new Set<string>();

    function includeAncestors(page: WikiPage) {
      visible.add(page.id);
      if (!page.parent_id) return;

      const parent = pages.find((item) => item.id === page.parent_id);
      if (parent) includeAncestors(parent);
    }

    for (const page of pages) {
      if (
        page.title.toLowerCase().includes(normalized) ||
        page.content.toLowerCase().includes(normalized)
      ) {
        includeAncestors(page);
      }
    }

    return visible;
  }, [pages, search]);

  function childrenOf(parentId: string | null): WikiPage[] {
    return pages
      .filter(
        (page) =>
          page.parent_id === parentId &&
          (!visibleIds || visibleIds.has(page.id)),
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, pageId: string) {
    setDragId(pageId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>, pageId: string) {
    if (!dragId || dragId === pageId) return;

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    const position: DropPosition =
      ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';

    setDropTarget({ id: pageId, position });
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();

    const pageId = event.dataTransfer.getData('text/plain') || dragId;
    if (!pageId || !dropTarget?.id) return;

    void onMovePage(pageId, dropTarget.id, dropTarget.position);
    setDragId(null);
    setDropTarget(null);
  }

  function handleRootDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const pageId = event.dataTransfer.getData('text/plain') || dragId;
    if (!pageId) return;

    void onMovePage(pageId, null, 'inside');
    setDragId(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDragId(null);
    setDropTarget(null);
  }

  async function saveCurrentPage() {
    if (!selected || saving) return;

    setSaving(true);
    const updated = await onSavePage({
      ...selected,
      title: draftTitle.trim() || selected.title,
      content: draftContent,
    });

    if (updated) {
      setDraftTitle(updated.title);
      setDraftContent(updated.content);
      setNotice('Saved.');
    }

    setSaving(false);
  }

  async function restoreRevision(revision: Revision) {
    if (!selected || saving) return;

    const confirmed = window.confirm(
      'Restore revision ' + revision.revision_number + ' of "' + selected.title + '"? The current content will be kept in history.',
    );

    if (!confirmed) return;

    setSaving(true);

    const restored = await onSavePage({
      ...selected,
      title: revision.title,
      content: revision.content.replace(/\\n/g, '\n'),
    });

    if (restored) {
      setDraftTitle(restored.title);
      setDraftContent(restored.content);
      setHistoryOpen(false);
      setNotice('Revision restored.');
    }

    setSaving(false);
  }

  async function createRootPage() {
    const title = window.prompt('New wiki page name');
    if (!title?.trim()) return;

    const page = await onCreatePage(null, title.trim());
    if (page) onSelect(page);
  }

  async function createChildPage() {
    if (!selected || !childTitle.trim()) return;

    const page = await onCreatePage(selected.id, childTitle.trim());

    if (page) {
      setExpandedIds((current) => new Set(current).add(selected.id));
      onSelect(page);
      setChildTitle('');
      setChildCreateOpen(false);
    }
  }

  async function deleteCurrentPage() {
    if (!selected) return;

    const confirmed = window.confirm(
      'Delete "' + selected.title + '"? Pages with children must be moved or deleted first.',
    );

    if (!confirmed) return;

    const deleted = await onDeletePage(selected);
    if (deleted) setNotice('Deleted.');
  }

  return (
    <section className="wiki-layout">
      <aside className="wiki-tree-panel">
        <div className="wiki-tree-header">
          <div>
            <span className="dock-kicker">PROJECT WIKI</span>
            <h2>Documentation</h2>
          </div>
          <span className="wiki-count">{pages.length}</span>
        </div>

        <div className="wiki-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search wiki..."
            aria-label="Search wiki"
          />
          <button type="button" className="wiki-new-button" onClick={() => void createRootPage()}>
            + Page
          </button>
        </div>

        <div className="wiki-tree" onDragEnd={handleDragEnd}>
          {childrenOf(null).map((page) => (
            <WikiTreeNode
              key={page.id}
              page={page}
              pages={pages}
              selectedId={selectedId}
              expandedIds={expandedIds}
              visibleIds={visibleIds}
              onSelect={onSelect}
              onToggle={toggleExpanded}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              dropTarget={dropTarget}
            />
          ))}

          <div
            className={'wiki-root-drop' + (dragId ? ' active' : '')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleRootDrop}
          >
            Drop here to move a page to the root
          </div>

          {pages.length === 0 && (
            <div className="wiki-tree-empty">
              <strong>No pages yet</strong>
              <span>Create a page to start your wiki.</span>
            </div>
          )}

          {pages.length > 0 && childrenOf(null).length === 0 && (
            <div className="wiki-tree-empty">
              <strong>No search matches</strong>
              <span>Try another search term.</span>
            </div>
          )}
        </div>
      </aside>

      <section className="wiki-content-panel">
        {selected ? (
          <>
            <div className="wiki-breadcrumb">
              <button
                type="button"
                onClick={() => {
                  const rootPage = getBreadcrumb(selected, pages)[0];
                  if (rootPage) onSelect(rootPage);
                  else window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Wiki
              </button>
              <span>›</span>
              <strong>{selected.title}</strong>
            </div>

            <div className="wiki-page-header">
              <div>
                <span className="dock-kicker">DOCUMENTATION PAGE</span>
                <h2>{draftTitle || selected.title}</h2>
                <p>Updated {formatDate(selected.updated_at)}</p>
              </div>

              <div className="wiki-header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setChildCreateOpen((current) => !current)}
                >
                  + Child page
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setHistoryOpen((current) => !current)}
                >
                  History
                </button>
                <button type="button" className="danger-button" onClick={() => void deleteCurrentPage()}>
                  Delete
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving}
                  onClick={() => void saveCurrentPage()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {notice && <div className="wiki-inline-notice">{notice}</div>}

            {childCreateOpen && (
              <div className="wiki-child-create">
                <input
                  value={childTitle}
                  onChange={(event) => setChildTitle(event.target.value)}
                  placeholder={'New page under "' + selected.title + '"'}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void createChildPage();
                  }}
                />
                <button type="button" className="primary-button" onClick={() => void createChildPage()}>
                  Create child
                </button>
              </div>
            )}

            <div className="wiki-page-location">
              <button type="button" onClick={() => onSelect(null)}>Wiki</button>
              {getBreadcrumb(selected, pages).map((page) => (
                <span key={page.id} className="wiki-location-item">
                  <span>›</span>
                  <button type="button" onClick={() => onSelect(page)}>{page.title}</button>
                </span>
              ))}
              <span>›</span>
              <strong>{selected.title}</strong>
            </div>

            <div className="wiki-editor-toolbar">
              <div className="editor-mode-tabs">
                {(['write', 'split', 'preview'] as EditorMode[]).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={editorMode === mode ? 'active' : ''}
                    onClick={() => setEditorMode(mode)}
                  >
                    {mode === 'write' ? 'Write' : mode === 'split' ? 'Split' : 'Preview'}
                  </button>
                ))}
              </div>
              <span className="markdown-note">Markdown supported</span>
            </div>

            {editorMode === 'write' && (
              <div className="wiki-editor write-mode">
                <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                <textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} />
              </div>
            )}

            {editorMode === 'preview' && (
              <article className="wiki-markdown-preview">
                <MarkdownRenderer markdown={draftContent} />
              </article>
            )}

            {editorMode === 'split' && (
              <div className="wiki-split-editor">
                <div className="wiki-editor">
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                  <textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} />
                </div>
                <article className="wiki-markdown-preview split-preview">
                  <MarkdownRenderer markdown={draftContent} />
                </article>
              </div>
            )}

            {historyOpen && (
              <aside className="wiki-history-panel">
                <div className="history-heading">
                  <div>
                    <span className="dock-kicker">VERSION HISTORY</span>
                    <h3>Revisions</h3>
                  </div>
                  <button type="button" onClick={() => setHistoryOpen(false)}>×</button>
                </div>

                {historyLoading && <div className="history-empty">Loading revisions...</div>}
                {historyError && <div className="history-error">{historyError}</div>}
                {!historyLoading && !historyError && revisions.length === 0 && (
                  <div className="history-empty">No revisions recorded yet.</div>
                )}

                {!historyLoading && !historyError && revisions.map((revision) => (
                  <article className="revision-row" key={revision.id}>
                    <div>
                      <strong>Revision {revision.revision_number}</strong>
                      <span>{formatDate(revision.created_at)}</span>
                    </div>
                    <p>{revision.title}</p>
                    <button type="button" onClick={() => void restoreRevision(revision)}>
                      Restore
                    </button>
                  </article>
                ))}
              </aside>
            )}
          </>
        ) : (
          <div className="wiki-empty-content">
            <span className="dock-kicker">PROJECT WIKI</span>
            <h2>Select a page</h2>
            <p>Choose a document from the tree. Wiki remembers your selected page and expanded branches.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function WikiTreeNode({
  page,
  pages,
  selectedId,
  expandedIds,
  visibleIds,
  onSelect,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  dropTarget,
}: {
  page: WikiPage;
  pages: WikiPage[];
  selectedId: string | null;
  expandedIds: Set<string>;
  visibleIds: Set<string> | null;
  onSelect: (page: WikiPage) => void;
  onToggle: (id: string) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, pageId: string) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>, pageId: string) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  dropTarget: { id: string | null; position: DropPosition } | null;
}) {
  const children = pages
    .filter(
      (child) =>
        child.parent_id === page.id &&
        (!visibleIds || visibleIds.has(child.id)),
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(page.id) || visibleIds !== null;
  const dropClass =
    dropTarget?.id === page.id ? ' drop-' + dropTarget.position : '';

  return (
    <div className="wiki-tree-node" data-wiki-node={page.id}>
      <div className="wiki-tree-node-row">
        <button
          type="button"
          className={'wiki-tree-toggle-button' + (hasChildren ? '' : ' empty')}
          onClick={() => hasChildren && onToggle(page.id)}
          aria-label={hasChildren ? (expanded ? 'Collapse' : 'Expand') : 'No child pages'}
        >
          {hasChildren ? (expanded ? '⌄' : '›') : '·'}
        </button>

        <button
          type="button"
          draggable
          className={'wiki-tree-item' + (selectedId === page.id ? ' selected' : '') + dropClass}
          onClick={() => onSelect(page)}
          onDragStart={(event) => onDragStart(event, page.id)}
          onDragOver={(event) => onDragOver(event, page.id)}
          onDrop={onDrop}
        >
          <span className="wiki-tree-icon">□</span>
          <span>{page.title}</span>
        </button>
      </div>

      {hasChildren && expanded && (
        <div className="wiki-tree-children">
          {children.map((child) => (
            <WikiTreeNode
              key={child.id}
              page={child}
              pages={pages}
              selectedId={selectedId}
              expandedIds={expandedIds}
              visibleIds={visibleIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              dropTarget={dropTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getBreadcrumb(page: WikiPage, pages: WikiPage[]): WikiPage[] {
  const chain: WikiPage[] = [];
  let parentId = page.parent_id;

  while (parentId) {
    const parent = pages.find((item) => item.id === parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parent_id;
  }

  return chain;
}

function MarkdownRenderer({ markdown }: { markdown: string }) {
  const normalized = markdown.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: React.ReactElement[] = [];
  const fence = String.fromCharCode(96).repeat(3);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith(fence)) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith(fence)) {
        codeLines.push(lines[index]);
        index += 1;
      }

      index += 1;

      blocks.push(
        <pre className="markdown-code-block" key={'code-' + index}>
          <code data-language={language || undefined}>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      const headingElements = [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
      ] as const;
      const Tag = headingElements[level - 1];

      blocks.push(
        <Tag key={'heading-' + index}>
          <MarkdownInline text={heading[2]} />
        </Tag>,
      );

      index += 1;
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push(<hr key={'hr-' + index} />);
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index].startsWith('> ')) {
        quoteLines.push(lines[index].slice(2));
        index += 1;
      }

      blocks.push(
        <blockquote key={'quote-' + index}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>
              <MarkdownInline text={quoteLine} />
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];

      while (index < lines.length) {
        const match = ordered
          ? lines[index].match(/^\d+\.\s+(.*)$/)
          : lines[index].match(/^[-*+]\s+(.*)$/);

        if (!match) break;
        items.push(match[1]);
        index += 1;
      }

      const Tag = ordered ? 'ol' : 'ul';

      blocks.push(
        <Tag key={'list-' + index}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <MarkdownInline text={item} />
            </li>
          ))}
        </Tag>,
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,6}\s+/.test(lines[index]) &&
      !/^>\s+/.test(lines[index]) &&
      !lines[index].startsWith(fence) &&
      !/^[-*+]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={'paragraph-' + index}>
        <MarkdownInline text={paragraphLines.join(' ')} />
      </p>,
    );
  }

  return <div className="markdown-rendered">{blocks}</div>;
}

function MarkdownInline({ text }: { text: string }) {
  const codeChar = String.fromCharCode(96);
  const pattern = new RegExp(
    '(' +
      codeChar +
      '[^' +
      codeChar +
      ']+' +
      codeChar +
      '|\\*\\*[^*]+\\*\\*|__[^_]+__|\\*[^*]+\\*|_[^_]+_|\\[[^\\]]+\\]\\([^\\)]+\\))',
    'g',
  );
  const tokens = text.split(pattern);

  return (
    <>
      {tokens.map((token, index) => {
        if (!token) return null;

        if (
          token.startsWith(codeChar) &&
          token.endsWith(codeChar) &&
          token.length > 2
        ) {
          return <code key={index}>{token.slice(1, -1)}</code>;
        }

        if (
          (token.startsWith('**') && token.endsWith('**')) ||
          (token.startsWith('__') && token.endsWith('__'))
        ) {
          return <strong key={index}>{token.slice(2, -2)}</strong>;
        }

        if (
          (token.startsWith('*') && token.endsWith('*')) ||
          (token.startsWith('_') && token.endsWith('_'))
        ) {
          return <em key={index}>{token.slice(1, -1)}</em>;
        }

        const link = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);

        if (link) {
          return (
            <a key={index} href={link[2]} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          );
        }

        return <span key={index}>{token}</span>;
      })}
    </>
  );
}

export default WikiView;
