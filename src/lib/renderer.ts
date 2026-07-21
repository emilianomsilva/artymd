import { Marked, type TokenizerExtension, type RendererExtension } from 'marked';
import katex from 'katex';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

// Common emoji shortcode map
const emojiMap: Record<string, string> = {
  rocket: '🚀',
  bulb: '💡',
  warning: '⚠️',
  books: '📚',
  fire: '🔥',
  joy: '😂',
  information_source: 'ℹ️',
  checkmark: '✅',
  question: '❓',
  star: '⭐',
  note: '📝',
  tip: '💡',
  important: '❗️',
  caution: '⚠️'
};

// Memoization cache keyed by a fast hash of the source so large documents
// don't require re-hashing the entire string on every keystroke/render.
const renderCache = new Map<string, string>();
const MAX_CACHE_SIZE = 64;

// Lightweight 32-bit FNV-1a hash — stable, fast, good enough for cache keys.
function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Mix in length to avoid collisions between different-length inputs
  return (h >>> 0).toString(36) + ':' + str.length.toString(36);
}

function resolveEmoji(shortcode: string): string {
  return emojiMap[shortcode.toLowerCase()] || '📝';
}

// Custom Marked Extensions for LaTeX
const blockKatex: TokenizerExtension & RendererExtension = {
  name: 'blockKatex',
  level: 'block',
  start(src: string) { return src.indexOf('$$'); },
  tokenizer(src: string) {
    const match = src.match(/^\$\$\s*([\s\S]*?)\s*\$\$/);
    if (match) {
      return {
        type: 'blockKatex',
        raw: match[0],
        text: match[1]
      };
    }
  },
  renderer(token: any) {
    try {
      return `<div class="katex-block">${katex.renderToString(token.text, {
        displayMode: true,
        throwOnError: false
      })}</div>`;
    } catch (err) {
      return `<div class="katex-error">${token.text}</div>`;
    }
  }
};

const inlineKatex: TokenizerExtension & RendererExtension = {
  name: 'inlineKatex',
  level: 'inline',
  start(src: string) { return src.indexOf('$'); },
  tokenizer(src: string) {
    const match = src.match(/^\$(?!\s)(?:\\.|[^$])+?(?<!\s)\$/);
    if (match) {
      return {
        type: 'inlineKatex',
        raw: match[0],
        text: match[0].slice(1, -1)
      };
    }
  },
  renderer(token: any) {
    try {
      return katex.renderToString(token.text, {
        displayMode: false,
        throwOnError: false
      });
    } catch (err) {
      return `<span class="katex-error">${token.text}</span>`;
    }
  }
};

const markedInstance = new Marked();

markedInstance.use({
  breaks: true,
  gfm: true
});

markedInstance.use({
  extensions: [blockKatex, inlineKatex]
});

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Configure Syntax Highlighting & Heading IDs
markedInstance.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        const cleanedText = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        return `<div class="mermaid">${escapeHtml(cleanedText)}</div>`;
      }
      const validLanguage = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(text, { language: validLanguage }).value;
      return `<pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
    },
    heading({ text, depth }) {
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    }
  }
});

// PREPROCESSOR: GFM Alerts & Emoji Callouts
// Converts blockquote alert syntax to raw HTML BEFORE marked processes it,
// avoiding conflicts with marked v18's built-in GFM alert handling.
function preprocessAdmonitions(markdown: string): string {
  // GFM Alerts: > [!NOTE] ... > content lines
  const gfmAlertRegex = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?((?:>\s?.*\n?)*)/gim;
  let result = markdown.replace(gfmAlertRegex, (_match, type, content) => {
    const alertType = type.toLowerCase();
    const innerContent = content.replace(/^>\s?/gm, '').trim();
    let icon = '📝';
    if (type.toUpperCase() === 'TIP') icon = '💡';
    if (type.toUpperCase() === 'IMPORTANT') icon = '❗️';
    if (type.toUpperCase() === 'WARNING' || type.toUpperCase() === 'CAUTION') icon = '⚠️';

    return `<div class="admonition admonition-${alertType}">\n<div class="admonition-title"><span class="admonition-icon">${icon}</span> ${type.toUpperCase()}</div>\n<div class="admonition-content">\n\n${innerContent}\n\n</div>\n</div>\n`;
  });

  // Custom Emoji Callouts: > [:emoji: Title] ... > content lines
  const emojiCalloutRegex = /^>\s*\[:([a-zA-Z0-9_+-]+):\s*(.*?)\]\s*\n?((?:>\s?.*\n?)*)/gim;
  result = result.replace(emojiCalloutRegex, (_match, emojiCode, title, content) => {
    const emoji = resolveEmoji(emojiCode);
    const innerContent = content.replace(/^>\s?/gm, '').trim();

    return `<div class="admonition admonition-custom">\n<div class="admonition-title"><span class="admonition-icon">${emoji}</span> ${title}</div>\n<div class="admonition-content">\n\n${innerContent}\n\n</div>\n</div>\n`;
  });

  return result;
}

// PREPROCESSOR: Tab Blocks Parsing (:::tab ... @tab Title ... :::)
function preprocessTabs(markdown: string): string {
  const tabBlockRegex = /:::tab\s*\n([\s\S]*?)\n:::/g;
  let tabGroupCounter = 0;

  return markdown.replace(tabBlockRegex, (match, blockContent) => {
    tabGroupCounter++;
    const tabGroupId = `tab-group-${tabGroupCounter}`;
    
    // Split by @tab
    const sections = blockContent.split(/^\s*@tab\s+/m);
    // Ignore anything before the first @tab
    sections.shift();

    if (sections.length === 0) return match;

    const tabsHtml: string[] = [];
    const panelsHtml: string[] = [];

    sections.forEach((section: string, index: number) => {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();

      // Render the body markdown recursively
      const bodyHtml = renderMarkdown(body);
      const isActive = index === 0 ? 'active' : '';
      const panelId = `${tabGroupId}-panel-${index}`;

      tabsHtml.push(`
        <button class="tab-header ${isActive}" data-tab-target="${panelId}">${title}</button>
      `);

      panelsHtml.push(`
        <div class="tab-panel ${isActive}" id="${panelId}">
          ${bodyHtml}
        </div>
      `);
    });

    return `
      <div class="tabs-container" id="${tabGroupId}">
        <div class="tabs-headers">
          ${tabsHtml.join('')}
        </div>
        <div class="tabs-panels">
          ${panelsHtml.join('')}
        </div>
      </div>
    `;
  });
}

// PREPROCESSOR: Slide Decks Parsing (@slidestart ... @slideend)
function preprocessSlides(markdown: string): string {
  const slideDeckRegex = /@slidestart(:t\d+)?\s*\n([\s\S]*?)\n@slideend/g;
  let deckCounter = 0;

  return markdown.replace(slideDeckRegex, (match, autoplayTag, deckContent) => {
    deckCounter++;
    const deckId = `slide-deck-${deckCounter}`;
    let autoplaySeconds = 0;
    if (autoplayTag) {
      autoplaySeconds = parseInt(autoplayTag.replace(':t', '')) || 0;
    }

    // Split slides by horizontal rule ---
    const slidesContent = deckContent.split(/\n\s*---\s*\n/);
    const slidesHtml = slidesContent.map((slideText: string, index: number) => {
      const isActive = index === 0 ? 'active' : '';
      // Parse slide markdown recursively
      const slideHtml = renderMarkdown(slideText.trim());
      return `<div class="slide ${isActive}" data-slide-index="${index}">${slideHtml}</div>`;
    });

    const dotsHtml = slidesContent.map((_: string, index: number) => {
      const isActive = index === 0 ? 'active' : '';
      return `<span class="slide-dot ${isActive}" data-dot-index="${index}"></span>`;
    });

    return `
      <div class="slide-deck-container" id="${deckId}" data-autoplay="${autoplaySeconds}" data-total-slides="${slidesContent.length}">
        <div class="slide-view">
          <div class="slide-wrapper">
            ${slidesHtml.join('')}
          </div>
        </div>
        <div class="slide-nav">
          <button class="slide-btn prev" data-action="prev">&larr;</button>
          <div class="slide-dots">
            ${dotsHtml.join('')}
          </div>
          <button class="slide-btn next" data-action="next">&rarr;</button>
        </div>
      </div>
    `;
  });
}

// PREPROCESSOR & POSTPROCESSOR: Footnotes
interface FootnoteDef {
  id: string;
  content: string;
}

function processFootnotes(markdown: string): { cleanMarkdown: string; footnotes: FootnoteDef[] } {
  const definitions: FootnoteDef[] = [];
  const footnoteDefRegex = /^\[\^([\w-]+)\]:\s*(.+)$/gm;

  // 1. Gather footnote definitions
  let match;
  let cleanMarkdown = markdown;
  while ((match = footnoteDefRegex.exec(markdown)) !== null) {
    definitions.push({
      id: match[1],
      content: match[2].trim()
    });
  }

  // Remove definitions from main body
  cleanMarkdown = cleanMarkdown.replace(footnoteDefRegex, '');

  return { cleanMarkdown, footnotes: definitions };
}

export function renderMarkdown(markdown: string): string {
  // Check cache first (keyed by a fast hash, not the raw string)
  const cacheKey = hashString(markdown);
  const cached = renderCache.get(cacheKey);
  if (cached) return cached;

  try {
    // 1. Process Footnotes definitions
    const { cleanMarkdown, footnotes } = processFootnotes(markdown);
    
    // 2. Preprocess custom blocks
    let processed = preprocessAdmonitions(cleanMarkdown);
    processed = preprocessSlides(processed);
    processed = preprocessTabs(processed);

    // 3. Render base Markdown
    let html = markedInstance.parse(processed) as string;

    // 4. Substitute footnote references `[^id]` in output HTML
    // We match `[^id]` that are not inside code tags. In HTML we can replace `[^id]` with anchors
    const footnoteRefRegex = /\[\^([\w-]+)\]/g;
    html = html.replace(footnoteRefRegex, (refMatch, fnId) => {
      // Find if this footnote is defined
      const isDefined = footnotes.some(f => f.id === fnId);
      if (!isDefined) return refMatch; // Let it remain as text if not defined
      
      return `<sup id="fnref-${fnId}"><a href="#fn-${fnId}" class="footnote-ref" data-footnote-ref="${fnId}">${fnId}</a></sup>`;
    });

    // 5. Append Footnotes section if any footnotes are defined
    if (footnotes.length > 0) {
      const footnoteItems = footnotes.map(fn => `
        <li id="fn-${fn.id}" class="footnote-item">
          <span class="footnote-content">${fn.content}</span>
          <a href="#fnref-${fn.id}" class="footnote-backref" data-footnote-backref="${fn.id}">↩</a>
        </li>
      `);
      
      html += `
        <hr class="footnotes-sep">
        <section class="footnotes">
          <ol class="footnotes-list">
            ${footnoteItems.join('')}
          </ol>
        </section>
      `;
    }

    // 6. Sanitize the generated HTML. KaTeX/mermaid inject trusted markup that
    // must survive; allowlist the classes/attributes we use. Inline `style` is
    // permitted (KaTeX depends on it) but all event-handler attributes are
    // stripped so untrusted content can never execute script.
    html = DOMPurify.sanitize(html, {
      ADD_TAGS: ['input', 'use', 'path', 'svg', 'annotation', 'semantics', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mover', 'munder', 'mspace', 'mstyle', 'mpadded', 'mtr', 'mtd', 'mtext', 'mphantom', 'mroot', 'menclose', 'munderover'],
      ADD_ATTR: ['target', 'data-tab-target', 'data-footnote-ref', 'data-footnote-backref', 'data-slide-index', 'data-dot-index', 'data-autoplay', 'data-total-slides', 'data-processed', 'tabindex', 'role', 'aria-hidden', 'xmlns', 'viewBox', 'preserveAspectRatio', 'fill', 'stroke', 'd', 'transform'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'base', 'meta'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'formaction', 'srcdoc']
    });

    // Store in cache (with size limit)
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value;
      if (firstKey) renderCache.delete(firstKey);
    }
    renderCache.set(cacheKey, html);

    return html;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return `<div class="error-container"><h3>Error rendering document</h3><pre>${String(error)}</pre></div>`;
  }
}
