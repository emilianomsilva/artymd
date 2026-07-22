import mermaid from 'mermaid';

let mermaidInitialized = false;

/**
 * Initializes (or re-initializes) Mermaid with the correct theme and security settings.
 */
export function initializeMermaid(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict'
  });
  mermaidInitialized = true;
}

/**
 * Preprocesses and auto-corrects common user syntax errors and edge cases in Mermaid diagram code:
 * 1. Strips HTML comments (<!-- ... -->) inside code blocks.
 * 2. Unescapes double-encoded HTML entities (&amp;, &lt;, &gt;).
 * 3. Normalizes spaced arrow typos (- ->, -- >, == >).
 * 4. Normalizes direction casing (graph td -> graph TD, graph lr -> graph LR).
 * 5. Auto-quotes unquoted subgraph titles containing spaces/parens.
 * 6. Auto-quotes link/edge annotations containing parens/special characters.
 * 7. Auto-quotes unquoted node labels containing parentheses, brackets, or special symbols.
 */
export function preprocessMermaidCode(code: string): string {
  if (!code) return '';

  let cleaned = code.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Unescape double-encoded HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // 3. Normalize spaced arrow typos
  cleaned = cleaned
    .replace(/-\s+->/g, '-->')
    .replace(/--\s+>/g, '-->')
    .replace(/==\s+>/g, '==>')
    .replace(/=\s+=>/g, '==>')
    .replace(/-\.\s+->/g, '-.->')
    .replace(/-\.-\s+>/g, '-.->');

  // 4. Normalize direction casing in graph / flowchart declarations
  cleaned = cleaned.replace(/^(\s*(?:graph|flowchart)\s+)(td|lr|rl|bt)\b/gim, (_, prefix, dir) => {
    return `${prefix}${dir.toUpperCase()}`;
  });

  // 5. Auto-quote unquoted subgraph titles with spaces or parentheses
  cleaned = cleaned.replace(/^(\s*subgraph\s+)(?![^\n]*\[)([^"\n]+?\([^\n]+\)[^\n]*)$/gm, (_, prefix, title) => {
    const t = title.trim();
    if (t.startsWith('"') && t.endsWith('"')) return `${prefix}${t}`;
    return `${prefix}"${t.replace(/"/g, "'")}"`;
  });

  // 6. Auto-quote edge/link annotations containing parens
  cleaned = cleaned.replace(/--\s+([^"\n|]+?\([^\n|]+\)[^"\n|]*?)\s+-->/g, (_, annotation) => {
    const a = annotation.trim();
    if (a.startsWith('"') && a.endsWith('"')) return `-- "${a}" -->`;
    return `-- "${a.replace(/"/g, "'")}" -->`;
  });

  const quoteIfNeeded = (text: string) => {
    let t = text.trim();
    if (!t) return t;
    if (t.startsWith('"') && t.endsWith('"')) return t;
    if (/[()\[\]{}#:]/.test(t)) {
      t = t.replace(/"/g, "'");
      return `"${t}"`;
    }
    return t;
  };

  // 7. Auto-quote unquoted node labels across all shape syntax
  // Stadium ([...])
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)\(\[\s*(.*?)\s*\]\)/g, (_, id, label) => {
    return `${id}([${quoteIfNeeded(label)}])`;
  });

  // Cylinder [(...)]
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)\[\(\s*(.*?)\s*\)\]/g, (_, id, label) => {
    return `${id}[(${quoteIfNeeded(label)})]`;
  });

  // Circle ((...))
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)\(\(\s*(.*?)\s*\)\)/g, (_, id, label) => {
    return `${id}((${quoteIfNeeded(label)}))`;
  });

  // Rectangle [ ... ]
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)\[(?![\[\(])\s*(.*?)\s*\]/g, (_, id, label) => {
    return `${id}[${quoteIfNeeded(label)}]`;
  });

  // Rhombus { ... }
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)\{\s*(.*?)\s*\}/g, (_, id, label) => {
    return `${id}{${quoteIfNeeded(label)}}`;
  });

  // Asymmetric > ... ]
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)>\s*(.*?)\s*\]/g, (_, id, label) => {
    return `${id}>[${quoteIfNeeded(label)}]`;
  });

  // Rounded ( ... )
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]+)\((?!\(|\[)\s*(.*?)\s*\)(?!\))/g, (_, id, label) => {
    return `${id}(${quoteIfNeeded(label)})`;
  });

  return cleaned;
}

/**
 * Finds and renders all un-processed Mermaid diagrams inside a container element.
 * Handles whitespace trimming, line-ending normalization, auto-fixing syntax bugs, and per-diagram error handling.
 */
export async function renderMermaidDiagrams(container: HTMLElement, isDark: boolean) {
  if (!mermaidInitialized) {
    initializeMermaid(isDark);
  }

  const els = container.querySelectorAll('.mermaid:not([data-processed]):not([data-rendering])');
  if (els.length === 0) return;

  const nodesToRender: HTMLElement[] = [];
  els.forEach(el => {
    if (el.textContent) {
      el.textContent = preprocessMermaidCode(el.textContent);
      el.setAttribute('data-rendering', 'true');
      nodesToRender.push(el as HTMLElement);
    }
  });

  if (nodesToRender.length === 0) return;

  // Process nodes individually for robust per-diagram isolation & auto-retry
  for (const node of nodesToRender) {
    try {
      await mermaid.run({
        nodes: [node],
        suppressErrors: true
      });
    } catch (err) {
      console.warn('Mermaid initial render attempt failed, applying entity fallback...', err);
      try {
        if (node.textContent) {
          node.textContent = node.textContent
            .replace(/\(/g, '#40;')
            .replace(/\)/g, '#41;');
        }
        await mermaid.run({
          nodes: [node],
          suppressErrors: true
        });
      } catch (fallbackErr) {
        console.error('Mermaid rendering failed completely for node:', fallbackErr);
      }
    }
  }
}
