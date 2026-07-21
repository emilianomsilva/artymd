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
 * Finds and renders all un-processed Mermaid diagrams inside a container element.
 * Handles whitespace trimming, line-ending normalization, and locking.
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
      // Normalize line endings and trim whitespace to prevent Mermaid v11 syntax crashes
      el.textContent = el.textContent.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Mark as rendering immediately to lock it against concurrent calls
      el.setAttribute('data-rendering', 'true');
      nodesToRender.push(el as HTMLElement);
    }
  });

  if (nodesToRender.length === 0) return;

  try {
    await mermaid.run({
      nodes: nodesToRender,
      suppressErrors: true
    });
  } catch (err) {
    console.error('Mermaid render error:', err);
  }
}
