/**
 * Shared content renderer for the landing page.
 * Used by both the admin preview and the public landing page.
 *
 * Supported block-level syntax:
 *   # Heading 1   ## Heading 2   ### Heading 3
 *   ---           Horizontal rule
 *   > Quote       Blockquote
 *   - Item        Bullet list
 *   1. Item       Numbered list
 *   ![alt](url)   Image (standalone line)
 *
 * Supported inline syntax:
 *   **bold**      Bold text
 *   *italic*      Italic text
 *   __underline__ Underlined text
 *   [text](url)   Link
 *   ![alt](url)   Inline image
 */

export function renderContent(text, keyPrefix = '') {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let paragraph = [];
  let listItems = [];
  let listType = null; // 'ul' | 'ol'

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      elements.push(
        <p key={`${keyPrefix}-p-${elements.length}`} className="text-gray-300 leading-relaxed mb-4">
          {formatInline(paragraph.join('\n'))}
        </p>
      );
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    const cls = listType === 'ol'
      ? 'list-decimal list-inside space-y-1 mb-4 text-gray-300'
      : 'list-disc list-inside space-y-1 mb-4 text-gray-300';
    elements.push(
      <Tag key={`${keyPrefix}-list-${elements.length}`} className={cls}>
        {listItems.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line — flush everything
    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList(); flushParagraph();
      elements.push(<h3 key={`${keyPrefix}-h3-${elements.length}`} className="text-lg font-semibold text-white mt-6 mb-2">{formatInline(trimmed.slice(4))}</h3>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList(); flushParagraph();
      elements.push(<h2 key={`${keyPrefix}-h2-${elements.length}`} className="text-xl font-bold text-white mt-8 mb-3">{formatInline(trimmed.slice(3))}</h2>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList(); flushParagraph();
      elements.push(<h1 key={`${keyPrefix}-h1-${elements.length}`} className="text-3xl font-bold text-white mt-8 mb-4">{formatInline(trimmed.slice(2))}</h1>);
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      flushList(); flushParagraph();
      elements.push(<hr key={`${keyPrefix}-hr-${elements.length}`} className="border-white/10 my-8" />);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList(); flushParagraph();
      elements.push(
        <blockquote key={`${keyPrefix}-bq-${elements.length}`} className="border-l-4 border-brand-500/40 pl-4 py-1 my-4 text-gray-400 italic">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Bullet list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listItems.push(trimmed.slice(2));
      continue;
    }

    // Numbered list item
    const olMatch = trimmed.match(/^\d+\.\s(.+)/);
    if (olMatch) {
      flushParagraph();
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(olMatch[1]);
      continue;
    }

    // Image (standalone line)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushList(); flushParagraph();
      elements.push(
        <div key={`${keyPrefix}-img-${elements.length}`} className="my-6">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded-xl border border-white/10" />
        </div>
      );
      continue;
    }

    // Regular text — accumulate into paragraph
    flushList();
    paragraph.push(line);
  }

  flushList();
  flushParagraph();
  return elements;
}

/**
 * Parse inline formatting and return React elements.
 * Processes: **bold**, *italic*, __underline__, [text](url), ![alt](url)
 */
function formatInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find earliest match of any inline pattern
    const patterns = [
      { type: 'img',       regex: /!\[([^\]]*)\]\(([^)]+)\)/ },
      { type: 'link',      regex: /(?<!!)\[([^\]]+)\]\(([^)]+)\)/ },
      { type: 'bold',      regex: /\*\*(.+?)\*\*/ },
      { type: 'underline', regex: /__(.+?)__/ },
      { type: 'italic',    regex: /(?<![*_])\*(?!\*)(.+?)(?<!\*)\*(?!\*)/ },
    ];

    let earliest = null;
    for (const p of patterns) {
      const m = remaining.match(p.regex);
      if (m && (!earliest || m.index < earliest.match.index)) {
        earliest = { type: p.type, match: m };
      }
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    const { type, match } = earliest;

    // Push text before the match
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    switch (type) {
      case 'img':
        parts.push(<img key={key++} src={match[2]} alt={match[1]} className="inline max-h-6" />);
        break;
      case 'link':
        parts.push(
          <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer"
             className="text-brand-400 hover:text-brand-300 underline">
            {match[1]}
          </a>
        );
        break;
      case 'bold':
        parts.push(<strong key={key++} className="text-white font-semibold">{match[1]}</strong>);
        break;
      case 'underline':
        parts.push(<span key={key++} className="underline text-gray-200">{match[1]}</span>);
        break;
      case 'italic':
        parts.push(<em key={key++} className="italic text-gray-200">{match[1]}</em>);
        break;
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}
