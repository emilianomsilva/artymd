import mermaid from 'mermaid';
import { invoke } from '@tauri-apps/api/core';

let mermaidInitialized = false;

export function initializeMermaid(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict'
  });
  mermaidInitialized = true;
}

interface MermaidFixEntry {
  description: string;
  line: number;
  original_text: string;
  fixed_text: string;
}

interface MermaidFixResult {
  original: string;
  fixed: string;
  fixes_applied: MermaidFixEntry[];
  diagram_type: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Iteratively fixes and renders Mermaid diagrams in a 3-stage loop:
 * Pass 0: Try Raw Text natively
 * Pass 1: Try Rust Fixer (fix_mermaid_diagram)
 * Pass 2: Try Entity Fallback
 */
export async function renderMermaidDiagrams(container: HTMLElement, isDark: boolean) {
  if (!mermaidInitialized) {
    initializeMermaid(isDark);
  }

  const els = container.querySelectorAll('.mermaid:not([data-processed]):not([data-rendering])');
  if (els.length === 0) return;

  for (const el of els) {
    const rawText = el.textContent ? el.textContent.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';
    if (!rawText) continue;

    el.setAttribute('data-rendering', 'true');

    let currentCode = rawText;
    let renderSuccess = false;
    let renderedSvg = '';
    let lastError = '';

    for (let pass = 0; pass < 3; pass++) {
      try {
        if (pass === 1) {
          try {
            const fixRes = await invoke<MermaidFixResult>('fix_mermaid_diagram', { code: currentCode });
            if (fixRes.fixes_applied.length > 0) {
              console.info(`Mermaid fixer applied ${fixRes.fixes_applied.length} fixes for ${fixRes.diagram_type}:`, fixRes.fixes_applied);
            }
            currentCode = fixRes.fixed;
          } catch (ipcErr) {
            console.warn('Rust fix_mermaid_diagram IPC failed, using current code:', ipcErr);
          }
        } else if (pass === 2) {
          currentCode = currentCode
            .replace(/\(/g, '#40;')
            .replace(/\)/g, '#41;');
        }

        const renderId = `mermaid-dyn-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(renderId, currentCode);
        
        renderedSvg = svg;
        renderSuccess = true;
        break; // Succeeded! Exit loop!
      } catch (err) {
        lastError = String(err);
        console.warn(`Mermaid render pass ${pass} failed:`, err);
      }
    }

    if (renderSuccess && renderedSvg) {
      el.innerHTML = renderedSvg;
      el.setAttribute('data-processed', 'true');
    } else {
      console.error('All Mermaid render passes failed for element:', lastError);
      el.innerHTML = `<div class="mermaid-error-box" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); font-family: var(--font-sans); margin: 1rem 0;"><h4 style="margin: 0 0 0.5rem; color: #e53935; font-size: 0.95rem;">Diagram Syntax Error</h4><pre style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.1); padding: 0.5rem; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(lastError)}</pre><details><summary style="cursor: pointer; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">View Source</summary><pre style="font-family: var(--font-mono); font-size: 0.8rem; margin-top: 0.5rem; white-space: pre-wrap;">${escapeHtml(rawText)}</pre></details></div>`;
      el.setAttribute('data-processed', 'true');
    }

    el.removeAttribute('data-rendering');
  }
}
