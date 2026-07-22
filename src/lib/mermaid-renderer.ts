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

  const quoteIfNeeded = (text: string) => {
    let t = text.trim();
    if (!t) return t;
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t;
    }
    if (/[()\[\]{}#:]/.test(t)) {
      t = t.replace(/"/g, "'");
      return `"${t}"`;
    }
    return t;
  };

  const lines = cleaned.split('\n');
  const processedLines = lines.map(line => {
    let l = line;

    if (/^\s*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|architecture)\b/i.test(l)) {
      return l;
    }

    if (/^\s*subgraph\b/i.test(l) && !l.includes('[') && !l.includes('"')) {
      return l.replace(/^(\s*subgraph\s+)(.+)$/i, (_, p, title) => `${p}"${title.trim()}"`);
    }

    l = l.replace(/--\s+([^"\n|]+?\([^\n|]+\)[^"\n|]*?)\s+-->/g, (_, annotation) => {
      return `-- ${quoteIfNeeded(annotation)} -->`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\(\[\s*(.*?)\s*\]\)/g, (_, id, label) => {
      return `${id}([${quoteIfNeeded(label)}])`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\[\[\s*(.*?)\s*\]\]/g, (_, id, label) => {
      const q = quoteIfNeeded(label);
      return `${id}[[${q}]]`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\[\(\s*(.*?)\s*\)\]/g, (_, id, label) => {
      return `${id}[(${quoteIfNeeded(label)})]`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\(\(\s*(.*?)\s*\)\)/g, (_, id, label) => {
      return `${id}((${quoteIfNeeded(label)}))`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\[(?![\[\(])\s*([^\]]*?)\s*\]/g, (_, id, label) => {
      return `${id}[${quoteIfNeeded(label)}]`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\{\s*([^\}]*?)\s*\}/g, (_, id, label) => {
      return `${id}{${quoteIfNeeded(label)}}`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)>\s*([^\]]*?)\s*\]/g, (_, id, label) => {
      return `${id}>[${quoteIfNeeded(label)}]`;
    });

    l = l.replace(/([a-zA-Z0-9_-]+)\((?!\(|\[)\s*([^\)]*?)\s*\)/g, (_, id, label) => {
      return `${id}(${quoteIfNeeded(label)})`;
    });

    return l;
  });

  return processedLines.join('\n');
}

/**
 * Finds and renders all un-processed Mermaid diagrams inside a container element.
 * Uses a Native-First, Multi-Stage Auto-Fixer Pipeline for universal diagram support.
 */
export async function renderMermaidDiagrams(container: HTMLElement, isDark: boolean) {
  if (!mermaidInitialized) {
    initializeMermaid(isDark);
  }

  const els = container.querySelectorAll('.mermaid:not([data-processed]):not([data-rendering])');
  if (els.length === 0) return;

  const nodesToRender: { el: HTMLElement; rawText: string }[] = [];
  els.forEach(el => {
    if (el.textContent) {
      const rawText = el.textContent.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      el.setAttribute('data-rendering', 'true');
      nodesToRender.push({ el: el as HTMLElement, rawText });
    }
  });

  if (nodesToRender.length === 0) return;

  for (const { el, rawText } of nodesToRender) {
    // STAGE 1: Try Native Render (Zero Mutation)
    try {
      el.textContent = rawText;
      await mermaid.run({
        nodes: [el],
        suppressErrors: true
      });
      continue; // Native succeeded!
    } catch (_nativeErr) {
      console.warn('Mermaid native render failed, proceeding to Stage 2 Auto-Fixer...');
    }

    // STAGE 2: Auto-Fixer Pass 1 (Sanitize labels, unquote parens, fix arrow typos)
    try {
      el.removeAttribute('data-processed');
      el.textContent = preprocessMermaidCode(rawText);
      await mermaid.run({
        nodes: [el],
        suppressErrors: true
      });
      continue; // Stage 2 succeeded!
    } catch (_pass1Err) {
      console.warn('Mermaid Stage 2 Auto-Fixer failed, proceeding to Stage 3 Entity Fallback...');
    }

    // STAGE 3: Auto-Fixer Pass 2 (Entity Fallback)
    try {
      el.removeAttribute('data-processed');
      el.textContent = preprocessMermaidCode(rawText)
        .replace(/\(/g, '#40;')
        .replace(/\)/g, '#41;');
      await mermaid.run({
        nodes: [el],
        suppressErrors: true
      });
    } catch (finalErr) {
      console.error('Mermaid rendering failed completely for diagram node:', finalErr);
    }
  }
}
