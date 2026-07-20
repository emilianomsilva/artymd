const paperDimensions: Record<string, string> = {
  A3: '297mm 420mm',
  A4: '210mm 297mm',
  A5: '148mm 210mm',
  Letter: '215.9mm 279.4mm',
  Legal: '215.9mm 355.6mm',
  B5: '176mm 250mm'
};

const themePrintStyles: Record<string, { body: string; text: string; heading: string; link: string; bg: string; code: string }> = {
  default: { body: '#ffffff', text: '#212529', heading: '#7048e8', link: '#7048e8', bg: '#ffffff', code: '#f1f3f5' },
  github: { body: '#ffffff', text: '#24292e', heading: '#24292e', link: '#0366d6', bg: '#ffffff', code: '#f6f8fa' },
  academic: { body: '#fdfdfd', text: '#2c3e50', heading: '#2c3e50', link: '#8e44ad', bg: '#fdfdfd', code: '#ecf0f1' },
  minimal: { body: '#ffffff', text: '#1a1a1a', heading: '#000000', link: '#000000', bg: '#ffffff', code: '#f5f5f5' },
  neutral: { body: '#f8fafc', text: '#334155', heading: '#0f172a', link: '#0284c7', bg: '#f8fafc', code: '#f5f5f5' },
  arty: { body: '#ffffff', text: '#1f2937', heading: '#4f46e5', link: '#a855f7', bg: '#ffffff', code: '#f5f5f5' }
};

const darkThemePrintStyles: Record<string, { body: string; text: string; heading: string; link: string; bg: string; code: string }> = {
  default: { body: '#121316', text: '#e9ecef', heading: '#7e5cef', link: '#7e5cef', bg: '#121316', code: '#191b22' },
  github: { body: '#0d1117', text: '#c9d1d9', heading: '#f0f6fc', link: '#58a6ff', bg: '#0d1117', code: '#161b22' },
  academic: { body: '#1a202c', text: '#e2e8f0', heading: '#edf2f7', link: '#a78bfa', bg: '#1a202c', code: '#2d2d2d' },
  minimal: { body: '#ffffff', text: '#e5e5e5', heading: '#ffffff', link: '#ffffff', bg: '#0a0a0a', code: '#2d2d2d' },
  neutral: { body: '#0f172a', text: '#cbd5e1', heading: '#f8fafc', link: '#38bdf8', bg: '#0f172a', code: '#2d2d2d' },
  arty: { body: '#0b0f19', text: '#e5e7eb', heading: '#818cf8', link: '#c084fc', bg: '#0b0f19', code: '#1e293b' }
};

export interface PrintOptions {
  paper: string;
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  showPageNumbers: boolean;
  theme: string;
  darkMode: boolean;
}

function buildPrintCSS(html: string, options: PrintOptions): { css: string; content: string } {
  const dim = paperDimensions[options.paper] || '210mm 297mm';
  const size = options.orientation === 'landscape'
    ? dim.split(' ').reverse().join(' ')
    : dim;

  const themeColors = options.darkMode ? darkThemePrintStyles : themePrintStyles;
  const colors = themeColors[options.theme] || themeColors.default;

  const pageNumberCSS = options.showPageNumbers ? `
    @page {
      @bottom-center {
        content: counter(page);
        font-family: system-ui, sans-serif;
        font-size: 9pt;
        color: ${colors.text}88;
      }
    }
  ` : '';

  const css = `
  @page {
    size: ${size};
    margin: ${options.marginMm}mm;
    ${pageNumberCSS}
  }

  * { box-sizing: border-box; }

  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    color: ${colors.text};
    background: ${colors.body};
    margin: 0;
    padding: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    color: ${colors.heading};
    page-break-after: avoid;
    break-after: avoid;
  }

  h1 { page-break-before: always; margin-top: 0; }
  h1:first-of-type { page-break-before: auto; }

  a { color: ${colors.link}; }

  pre, img, table, blockquote, .admonition, .mermaid,
  .tabs-container, .katex-display, .slide-deck-container {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  pre {
    background: ${colors.code};
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 10pt;
  }

  code { background: ${colors.code}; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 10pt; }
  pre code { background: transparent; padding: 0; }

  img { max-width: 100%; height: auto; }

  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { border: 1px solid ${colors.text}44; padding: 0.5rem; text-align: left; }
  th { background: ${colors.code}; }

  blockquote {
    border-left: 4px solid ${colors.heading};
    padding: 0.5rem 1rem;
    margin: 1rem 0;
    color: ${colors.text}cc;
  }
  `;

  return { css, content: html };
}

export function openPrintWindow(html: string, options: PrintOptions) {
  const { css, content } = buildPrintCSS(html, options);

  // Render the printable document into an off-screen node in the MAIN window,
  // then trigger the webview's native print. On Linux (webkit2gtk) this opens
  // the GTK print dialog, which lets the user choose "Print to File" (PDF)
  // and pick exactly where to save. Printing from the main window (rather than
  // a detached pop-up) is what gives Tauri's webview a real print dialog.
  const existing = document.getElementById('print-root');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'print-root';

  root.innerHTML = `
<style>
  #print-root {
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  }

  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      overflow: visible !important;
      background: ${options.darkMode ? '#0a0a0a' : '#ffffff'} !important;
    }

    body > *:not(#print-root) {
      display: none !important;
    }

    #print-root {
      position: static !important;
      top: auto !important;
      left: auto !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      pointer-events: auto !important;
      z-index: auto !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      transform: none !important;
      zoom: 1 !important;
    }

    ${css}
  }
</style>
<article class="markdown-body theme-${options.theme}">
  ${content}
</article>`;

  document.body.appendChild(root);

  const cleanup = () => {
    window.removeEventListener('focus', cleanup);
    window.removeEventListener('afterprint', cleanup);
    const el = document.getElementById('print-root');
    if (el) el.remove();
  };

  window.onafterprint = cleanup;
  window.addEventListener('focus', cleanup);
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 60000);

  window.print();
}
