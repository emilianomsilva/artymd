<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { currentFileText, currentFilePath, openFileInTab, tabsList, activeTabId, switchTab, onTabSwitch, createNewTab } from '../stores/content';
  import { theme, zoom, rtl, showHelp, previewTheme, sidebarOpen } from '../stores/config';
  import { renderMarkdown } from '../lib/renderer';
  import { locale, t } from '../lib/i18n';
  import { readTextFile } from '@tauri-apps/plugin-fs';
  import { renderMermaidDiagrams, initializeMermaid } from '../lib/mermaid-renderer';
  import { startFileWatcher, stopFileWatcher } from '../lib/file-watcher';
  import { reloadActiveFile } from '../lib/file-actions';
  import FindBar from './FindBar.svelte';
  import { tick } from 'svelte';

  let findBar: FindBar | undefined = $state();

  // Open the find bar when triggered from the header button or Ctrl+F.
  if (typeof window !== 'undefined') {
    window.addEventListener('arty-find', () => findBar?.openFind());
  }

  // Initialize and run Mermaid reactively
  $effect(() => {
    const isDark = $theme === 'dark';
    initializeMermaid(isDark);
  });

  // Reading-position memory (G7): remember scroll offset per file path.
  const scrollMemory = new Map<string, number>();
  let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function onViewportScroll(e: Event) {
    const target = e.currentTarget as HTMLElement;
    const path = $currentFilePath;
    if (!path) return;
    if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
      scrollMemory.set(path, target.scrollTop);
    }, 200);
  }

  function restoreScroll() {
    const path = $currentFilePath;
    const viewport = document.querySelector('.view-viewport') as HTMLElement | null;
    if (!viewport) return;
    const saved = path ? scrollMemory.get(path) : undefined;
    viewport.scrollTop = saved ?? 0;
  }

  // Reactive file watcher bound to $currentFilePath for instant auto-reload
  $effect(() => {
    const path = $currentFilePath;
    if (path) {
      startFileWatcher(path, async () => {
        try {
          const content = await readTextFile(path);
          const name = path.split(/[/\\]/).pop() || 'document.md';
          openFileInTab(content, path, name);
        } catch (err) {
          console.error('Failed to reload file on disk change:', err);
        }
      });
    } else {
      stopFileWatcher();
    }

    return () => {
      stopFileWatcher();
    };
  });

  // Cleanup mermaid elements and restore reading position on tab switch
  $effect(() => {
    const cleanup = onTabSwitch(async () => {
      document.querySelectorAll('.mermaid[data-processed]').forEach(el => {
        el.removeAttribute('data-processed');
      });

      await tick();
      setTimeout(restoreScroll, 60);
    });
    return cleanup;
  });

  $effect(() => {
    const html = renderedHtml;
    const isDark = $theme === 'dark';

    const timer = setTimeout(async () => {
      const container = document.querySelector('.markdown-body') as HTMLElement | null;
      if (container) {
        await renderMermaidDiagrams(container, isDark);
      }
    }, 60);

    return () => clearTimeout(timer);
  });

  // View Mode Zoom & Pan State
  let panX = $state<number>(0);
  let panY = $state<number>(0);
  let isDragging = $state<boolean>(false);
  let startX = $state<number>(0);
  let startY = $state<number>(0);
  let spacePressed = $state<boolean>(false);

  // Markdown hover tooltip state
  let tooltipData = $state<string | null>(null);
  let tooltipX = $state<number>(0);
  let tooltipY = $state<number>(0);

  // Render markdown HTML when text changes
  let renderedHtml = $derived(renderMarkdown($currentFileText));

  // Pan interaction events
  function onMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && spacePressed)) {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
  }

  function onMouseUp() {
    isDragging = false;
  }

  function resetViewport() {
    panX = 0;
    panY = 0;
    zoom.set(1.0);
  }

  // Mouse wheel Zoom (Ctrl + Wheel)
  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      zoom.update(z => {
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        return Math.max(0.5, Math.min(3.0, z + delta));
      });
    }
  }

  // Hover insights event handlers
  function handleMouseOver(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      if (href) {
        tooltipData = href;
        tooltipX = e.clientX + 12;
        tooltipY = e.clientY + 15;
      }
    }
  }

  function handleMouseMoveTooltip(e: MouseEvent) {
    if (tooltipData) {
      tooltipX = e.clientX + 12;
      tooltipY = e.clientY + 15;
    }
  }

  function handleMouseOut(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link) {
      tooltipData = null;
    }
  }

  // Keyboard accessibility handlers for viewport
  function handleViewportKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    // Enter/Space on links/buttons inside viewport
    if ((e.key === 'Enter' || e.key === ' ') && (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('.tab-header, .slide-btn, .slide-dot, .footnote-ref, .footnote-backref'))) {
      target.click();
      e.preventDefault();
    }
    // Escape to clear tooltip
    if (e.key === 'Escape' && tooltipData) {
      tooltipData = null;
    }
  }

  function handleFocus(e: FocusEvent) {
    // Mirror mouseover behavior for keyboard focus
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      if (href) {
        tooltipData = href;
        tooltipX = target.getBoundingClientRect().left + 12;
        tooltipY = target.getBoundingClientRect().bottom + 15;
      }
    }
  }

  function handleBlur(e: FocusEvent) {
    // Mirror mouseout behavior for keyboard blur
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link) {
      tooltipData = null;
    }
  }

  // Slide Deck Autoplay Engine
  let slideIntervals: number[] = [];

  function initSlideshows() {
    slideIntervals.forEach(clearInterval);
    slideIntervals = [];

    const containers = document.querySelectorAll('.slide-deck-container');
    containers.forEach((container) => {
      const autoplay = parseInt(container.getAttribute('data-autoplay') || '0');
      if (autoplay > 0) {
        const intervalId = window.setInterval(() => {
          advanceSlide(container as HTMLElement, 1);
        }, autoplay * 1000);
        slideIntervals.push(intervalId);
      }
    });
  }

  function advanceSlide(container: HTMLElement, direction: number) {
    const slides = container.querySelectorAll('.slide');
    const dots = container.querySelectorAll('.slide-dot');
    let currentIndex = 0;

    slides.forEach((slide, index) => {
      if (slide.classList.contains('active')) {
        currentIndex = index;
      }
    });

    const total = slides.length;
    let nextIndex = (currentIndex + direction + total) % total;

    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === nextIndex);
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === nextIndex);
    });
  }

  $effect(() => {
    if (renderedHtml) {
      setTimeout(initSlideshows, 100);
    }
  });

  // Relative link resolution (Wiki style)
  async function handleCrossFileLink(relPath: string) {
    try {
      const currentPath = $currentFilePath;
      if (!currentPath) {
        alert('Please open a file before opening relative links.');
        return;
      }

      const pathSeparator = currentPath.includes('\\') ? '\\' : '/';
      const parts = currentPath.split(pathSeparator);
      parts.pop();
      const parentDir = parts.join(pathSeparator);

      let cleanRel = relPath.replace(/^\.\//, '');
      const targetPath = parentDir + pathSeparator + cleanRel.replace(/\//g, pathSeparator);

      const content = await readTextFile(targetPath);
      const name = targetPath.split(/[/\\]/).pop() || 'document.md';

      openFileInTab(content, targetPath, name);
    } catch (err) {
      console.error('Failed to open cross-file link:', err);
      alert('Failed to open link: ' + err);
    }
  }

  // Global viewport interactions click delegate
  function handleViewportClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Tab blocks switch
    const tabHeader = target.closest('.tab-header');
    if (tabHeader) {
      const panelId = tabHeader.getAttribute('data-tab-target');
      const container = tabHeader.closest('.tabs-container');
      if (container && panelId) {
        container.querySelectorAll('.tab-header').forEach(h => h.classList.remove('active'));
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tabHeader.classList.add('active');
        const panel = container.querySelector(`#${panelId}`);
        if (panel) panel.classList.add('active');
      }
      return;
    }

    // Slides next/prev click
    const slideBtn = target.closest('.slide-btn');
    if (slideBtn) {
      const action = slideBtn.getAttribute('data-action');
      const container = slideBtn.closest('.slide-deck-container') as HTMLElement;
      if (container && action) {
        advanceSlide(container, action === 'next' ? 1 : -1);
      }
      return;
    }

    // Slides dot index click
    const slideDot = target.closest('.slide-dot');
    if (slideDot) {
      const dotIndex = parseInt(slideDot.getAttribute('data-dot-index') || '0');
      const container = slideDot.closest('.slide-deck-container') as HTMLElement;
      if (container) {
        const slides = container.querySelectorAll('.slide');
        const dots = container.querySelectorAll('.slide-dot');
        slides.forEach((slide, idx) => slide.classList.toggle('active', idx === dotIndex));
        dots.forEach((dot, idx) => dot.classList.toggle('active', idx === dotIndex));
      }
      return;
    }

    // Footnotes scroll transitions
    const fnRef = target.closest('.footnote-ref');
    if (fnRef) {
      e.preventDefault();
      const fnId = fnRef.getAttribute('data-footnote-ref');
      const targetItem = document.getElementById(`fn-${fnId}`);
      if (targetItem) {
        targetItem.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    const fnBackref = target.closest('.footnote-backref');
    if (fnBackref) {
      e.preventDefault();
      const refId = fnBackref.getAttribute('data-footnote-backref');
      const targetRef = document.getElementById(`fnref-${refId}`);
      if (targetRef) {
        targetRef.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Wiki cross-file relative link opening
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      if (href && (href.endsWith('.md') || href.endsWith('.markdown') || href.endsWith('.txt')) && !href.startsWith('http')) {
        e.preventDefault();
        handleCrossFileLink(href);
      }
    }
  }

  // Global keyboard shortcuts
  function handleGlobalShortcuts(e: KeyboardEvent) {
    if (e.key === 'F9') {
      e.preventDefault();
      sidebarOpen.update(o => !o);
      return;
    }

    if (e.key === 'F1') {
      e.preventDefault();
      showHelp.update(h => !h);
      return;
    }

    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
      e.preventDefault();
      reloadActiveFile();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      createNewTab();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      zoom.set(1.0);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('arty-open'));
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      findBar?.openFind();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault();
      const list = get(tabsList);
      if (list.length < 2) return;
      const activeId = get(activeTabId);
      const currentIndex = list.findIndex(t => t.id === activeId);
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + list.length) % list.length
        : (currentIndex + 1) % list.length;
      switchTab(list[nextIndex].id);
      return;
    }
  }

  // Space bar panning
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target && !['INPUT', 'TEXTAREA'].includes(target.tagName) && e.code === 'Space') {
      e.preventDefault();
      spacePressed = true;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spacePressed = false;
    }
  }

  onDestroy(() => {
    slideIntervals.forEach(clearInterval);
  });
</script>

<svelte:window
  onkeydown={(e) => { handleKeyDown(e); handleGlobalShortcuts(e); }}
  onkeyup={handleKeyUp}
  onmouseup={onMouseUp}
/>

<div
  class="viewer-container"
  dir={$rtl ? 'rtl' : 'ltr'}
>
  <div class="view-viewport-wrapper">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="view-viewport"
      tabindex="0"
      role="region"
      aria-label="Markdown preview"
      onmousedown={onMouseDown}
      onmousemove={onMouseMove}
      onwheel={handleWheel}
      onmouseover={handleMouseOver}
      onmouseout={handleMouseOut}
      onmousemovecapture={handleMouseMoveTooltip}
      onclick={handleViewportClick}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleViewportKeyDown}
      onscroll={onViewportScroll}
      class:grabbing={isDragging}
      class:panning-ready={spacePressed}
    >
      <div
        class="view-canvas"
        style="transform: translate({panX}px, {panY}px);"
      >
        <article class="markdown-body theme-{$previewTheme}" style="font-size: {$zoom * 1}rem;">
          {@html renderedHtml}
        </article>
      </div>
    </div>
  </div>
</div>

<!-- Hover tooltip detail popover -->
{#if tooltipData}
  <div class="tooltip-popover" style="left: {tooltipX}px; top: {tooltipY}px;">
    {tooltipData}
  </div>
{/if}

<!-- Help Dialog Modal Overlay -->
{#if $showHelp}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title" onclick={() => showHelp.set(false)} onkeydown={(e) => { if (e.key === 'Escape') showHelp.set(false); }}>
    <div class="modal-content glass" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') showHelp.set(false); }}>
      <div class="modal-header">
        <h3 id="help-dialog-title">{t('helpTitle', $locale)}</h3>
        <button class="close-btn" onclick={() => showHelp.set(false)}>&times;</button>
      </div>
      <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
        <div class="help-section">
          <ul style="display: flex; flex-direction: column; gap: 0.5rem;">
            <li><strong>Zoom:</strong> {t('helpZoom', $locale)}</li>
            <li><strong>Pan:</strong> {t('helpPan', $locale)}</li>
            <li><strong>{t('zoomReset', $locale)}:</strong> {t('helpReset', $locale)}</li>
            <li><strong>Slides:</strong> {t('helpSlides', $locale)}</li>
            <li><strong>{t('findPlaceholder', $locale)}:</strong> {t('shortcutCtrlF', $locale)}</li>
          </ul>
        </div>

        <div class="help-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.95rem;">Keyboard Shortcuts</h4>
          <ul style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
            <li><kbd>{t('shortcutCtrlO', $locale)}</kbd></li>
            <li><kbd>{t('shortcutCtrlN', $locale)}</kbd></li>
            <li><kbd>{t('shortcutF5', $locale)}</kbd></li>
            <li><kbd>{t('shortcutCtrlTab', $locale)}</kbd></li>
            <li><kbd>{t('shortcutCtrlShiftTab', $locale)}</kbd></li>
            <li><kbd>{t('shortcutF9', $locale)}</kbd></li>
            <li><kbd>{t('shortcutF1', $locale)}</kbd></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
{/if}

<FindBar bind:this={findBar} />

<style>
  .viewer-container {
    flex-grow: 1;
    height: calc(100vh - var(--header-height) - var(--tabbar-height));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--bg-primary);
  }

  .view-viewport-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .view-viewport {
    flex-grow: 1;
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    outline: none;
    cursor: default;
  }

  .view-viewport.panning-ready {
    cursor: grab;
  }

  .view-viewport.grabbing {
    cursor: grabbing;
  }

  .view-canvas {
    width: 100%;
    min-height: 100%;
    padding: 3rem 4rem;
    box-sizing: border-box;
    transition: transform var(--transition-fast) cubic-bezier(0.1, 0.8, 0.2, 1);
  }

  .markdown-body {
    width: 100%;
    padding: 0;
    height: fit-content;
    transition: font-size var(--transition-fast) cubic-bezier(0.1, 0.8, 0.2, 1);
  }

  /* Help Modal Styling */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-content {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 2rem;
    width: 500px;
    max-width: 90%;
    box-shadow: var(--shadow-lg);
    animation: slideIn 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    transition: color var(--transition-fast);
    outline: none;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .modal-body ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-body li {
    color: var(--text-secondary);
    line-height: 1.6;
    font-size: 0.88rem;
  }

  kbd {
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.1);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.15rem 0.4rem;
    color: var(--text-primary);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from { transform: translateY(15px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
