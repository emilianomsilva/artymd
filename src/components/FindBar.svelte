<script lang="ts">
  import { locale, t } from '../lib/i18n';

  let query = $state('');
  let matchCount = $state(0);
  let activeIndex = $state(-1);
  let visible = $state(false);

  // Mirrors of the matches currently highlighted in the DOM (in document order).
  let marks: HTMLElement[] = [];
  let lastQuery = '';
  let lastRoot: HTMLElement | null = null;

  export function openFind(preset?: string) {
    visible = true;
    if (preset) query = preset;
    // Focus after render
    queueMicrotask(() => {
      const input = document.getElementById('find-input') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  export function closeFind() {
    visible = false;
    clearMarks();
    query = '';
    matchCount = 0;
    activeIndex = -1;
  }

  function clearMarks() {
    for (const m of marks) {
      const parent = m.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(m.textContent || ''), m);
      parent.normalize();
    }
    marks = [];
  }

  // Walk all text nodes inside the article, collecting those that match.
  function getTextNodes(root: HTMLElement): Text[] {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = (node.parentElement as HTMLElement | null);
        if (!el) return NodeFilter.FILTER_ACCEPT;
        const tag = el.tagName;
        // Skip script/style and already-highlighted marks
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes: Text[] = [];
    let n = walker.nextNode();
    while (n) {
      nodes.push(n as Text);
      n = walker.nextNode();
    }
    return nodes;
  }

  function highlight() {
    clearMarks();
    activeIndex = -1;

    const root = document.querySelector('.markdown-body') as HTMLElement | null;
    if (!root) return;
    lastRoot = root;

    const q = query.trim();
    if (q.length === 0) {
      matchCount = 0;
      return;
    }

    const lower = q.toLowerCase();
    const textNodes = getTextNodes(root);
    const segments: { node: Text; start: number; end: number }[] = [];

    for (const node of textNodes) {
      const text = node.textContent || '';
      const lowerText = text.toLowerCase();
      let from = 0;
      let idx = lowerText.indexOf(lower, from);
      while (idx !== -1) {
        segments.push({ node, start: idx, end: idx + q.length });
        from = idx + q.length;
        idx = lowerText.indexOf(lower, from);
      }
    }

    if (segments.length === 0) {
      matchCount = 0;
      return;
    }

    // Group ranges per text node; process each node's ranges in reverse so
    // earlier splits don't invalidate the indices of later ranges.
    const byNode = new Map<Text, { start: number; end: number }[]>();
    for (const s of segments) {
      const arr = byNode.get(s.node) || [];
      arr.push({ start: s.start, end: s.end });
      byNode.set(s.node, arr);
    }

    marks = [];
    for (const [node, ranges] of byNode) {
      ranges.sort((a, b) => b.start - a.start);
      const text = node.textContent || '';
      const parts: (Text | HTMLElement)[] = [];
      let cursor = text.length;
      for (const r of ranges) {
        if (r.end < cursor) {
          parts.unshift(document.createTextNode(text.slice(r.end, cursor)));
        }
        const mark = document.createElement('mark');
        mark.className = 'find-mark';
        mark.textContent = text.slice(r.start, r.end);
        parts.unshift(mark);
        cursor = r.start;
      }
      if (cursor > 0) parts.unshift(document.createTextNode(text.slice(0, cursor)));
      const parent = node.parentNode;
      if (!parent) continue;
      for (const p of parts) parent.insertBefore(p, node);
      parent.removeChild(node);
      for (const p of parts) {
        if (p instanceof HTMLElement && p.classList.contains('find-mark')) marks.push(p);
      }
    }

    matchCount = marks.length;
    // Restore document order for navigation.
    marks.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    lastQuery = q;
    if (matchCount > 0) goTo(0);
  }

  function goTo(index: number) {
    if (marks.length === 0) return;
    if (activeIndex >= 0 && marks[activeIndex]) marks[activeIndex].classList.remove('find-active');
    activeIndex = (index + marks.length) % marks.length;
    const el = marks[activeIndex];
    el.classList.add('find-active');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function next() {
    if (marks.length === 0) return;
    goTo(activeIndex + 1);
  }

  function prev() {
    if (marks.length === 0) return;
    goTo(activeIndex - 1);
  }

  function onInput() {
    highlight();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev(); else next();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFind();
    }
  }
</script>

{#if visible}
  <div class="find-bar" role="search">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" class="find-icon">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      id="find-input"
      type="text"
      bind:value={query}
      oninput={onInput}
      onkeydown={onKeydown}
      placeholder={t('findPlaceholder', $locale)}
      class="find-input"
      aria-label="Find in document"
    />
    <span class="find-count">
      {#if query.trim().length > 0}
        {matchCount === 0 ? t('findNone', $locale) : `${activeIndex + 1}/${matchCount}`}
      {/if}
    </span>
    <button class="find-btn" onclick={prev} aria-label="Previous match" title={t('findPrev', $locale)}>&uarr;</button>
    <button class="find-btn" onclick={next} aria-label="Next match" title={t('findNext', $locale)}>&darr;</button>
    <button class="find-btn find-close" onclick={closeFind} aria-label="Close find" title={t('cancel', $locale)}>&times;</button>
  </div>
{/if}

<style>
  .find-bar {
    position: absolute;
    top: 0.75rem;
    right: 1rem;
    z-index: 500;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 0.35rem 0.5rem;
    box-shadow: var(--shadow-md);
    animation: fadeIn 0.12s ease-out;
  }

  .find-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .find-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.85rem;
    width: 200px;
  }

  .find-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    min-width: 36px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .find-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    width: 26px;
    height: 26px;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    outline: none;
  }

  .find-btn:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .find-close {
    font-size: 1.1rem;
  }

  /* Highlight marks injected into the document */
  :global(mark.find-mark) {
    background-color: #ffe066;
    color: #212529;
    border-radius: 2px;
    padding: 0 1px;
  }
  :global(.dark mark.find-mark) {
    background-color: #ffd43b;
    color: #1a1a1a;
  }
  :global(mark.find-mark.find-active) {
    background-color: var(--accent-primary);
    color: #fff;
    box-shadow: 0 0 0 2px var(--accent-hover);
  }
</style>
