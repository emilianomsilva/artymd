<script lang="ts">
  import { sidebarOpen, sidebarWidth, rtl, sidebarSide } from '../stores/config';
  import { toc } from '../stores/content';
  import { locale, t } from '../lib/i18n';

  let searchQuery = $state<string>('');

  const filteredToc = $derived(
    $toc.filter(item => item.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function scrollToHeading(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  let startX = 0;
  let startWidth = 0;
  let isResizing = $state(false);

  function onResizeStart(e: MouseEvent) {
    e.preventDefault();
    startX = e.clientX;
    startWidth = $sidebarWidth;
    isResizing = true;
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    const renderedOnRight = ($rtl && $sidebarSide === 'left') || (!$rtl && $sidebarSide === 'right');
    const factor = renderedOnRight ? -1 : 1;
    const delta = (e.clientX - startX) * factor;
    sidebarWidth.set(Math.max(160, Math.min(window.innerWidth / 2, startWidth + delta)));
  }

  function onResizeEnd() {
    isResizing = false;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  }

  function onResizeKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const renderedOnRight = ($rtl && $sidebarSide === 'left') || (!$rtl && $sidebarSide === 'right');
      const factor = renderedOnRight ? -1 : 1;
      const delta = (e.key === 'ArrowRight' ? 10 : -10) * factor;
      sidebarWidth.set(Math.max(160, Math.min(window.innerWidth / 2, $sidebarWidth + delta)));
    } else if (e.key === 'Escape') {
      onResizeEnd();
    }
  }
</script>

<aside class="sidebar glass" class:closed={!$sidebarOpen} class:resizing={isResizing} class:side-right={$sidebarSide === 'right'} style="flex-basis: {$sidebarWidth}px;">
  <div class="sidebar-header">
    <h3 class="sidebar-title">{t('toc', $locale)}</h3>
    <button
      class="icon-btn sidebar-side-toggle"
      onclick={() => sidebarSide.update(s => s === 'left' ? 'right' : 'left')}
      title={t('toggleSidebarSide', $locale)}
      aria-label="Toggle TOC side"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        {#if $sidebarSide === 'left'}
          <polyline points="15 18 9 12 15 6" />
        {:else}
          <polyline points="9 18 15 12 9 6" />
        {/if}
      </svg>
    </button>
  </div>

  <div class="search-box">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      placeholder={t('searchPlaceholder', $locale)}
      bind:value={searchQuery}
      class="search-input"
    />
    {#if searchQuery}
      <button class="clear-search" onclick={() => searchQuery = ''} aria-label="Clear search">&times;</button>
    {/if}
  </div>

  <div class="toc-list">
    {#if filteredToc.length === 0}
      <p class="empty-state">{t('noHeadings', $locale)}</p>
    {:else}
      {#each filteredToc as item}
        <button
          class="toc-item level-{item.level}"
          onclick={() => scrollToHeading(item.id)}
        >
          <span class="toc-bullet">&bull;</span>
          <span class="toc-text">{item.text}</span>
        </button>
      {/each}
    {/if}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="resize-handle" role="separator" aria-label="Resize sidebar" tabindex="0" onmousedown={onResizeStart} onkeydown={onResizeKeyDown}></div>
</aside>

<style>
  .sidebar {
    flex-basis: 280px;
    flex-shrink: 0;
    height: calc(100vh - var(--header-height) - var(--tabbar-height));
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    transition: flex-basis var(--transition-slow), opacity var(--transition-slow);
    z-index: 90;
    user-select: none;
    overflow: hidden;
    position: relative;
    background: var(--bg-secondary);
    order: 0;
  }

  .sidebar.side-right {
    border-right: none;
    border-left: 1px solid var(--border-color);
    order: 1;
  }

  .sidebar.resizing {
    transition: none !important;
  }

  .sidebar.closed {
    flex-basis: 0 !important;
    opacity: 0;
    pointer-events: none;
    padding: 0;
    border: none;
  }

  .sidebar-header {
    padding: 1rem 1rem 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sidebar-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0;
  }

  .sidebar-side-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    outline: none;
  }

  .sidebar-side-toggle:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border-color: var(--border-color);
  }

  .search-box {
    display: flex;
    align-items: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.4rem 0.6rem;
    margin: 0.75rem 1rem;
    transition: border-color var(--transition-fast);
  }

  .search-box:focus-within {
    border-color: var(--border-active);
  }

  .search-icon {
    color: var(--text-muted);
    margin-right: 0.4rem;
    flex-shrink: 0;
  }

  .search-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.85rem;
    width: 100%;
  }

  .clear-search {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .clear-search:hover {
    color: var(--text-primary);
  }

  .toc-list {
    flex-grow: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 0.75rem 1rem;
  }

  .empty-state {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    padding: 2rem 0;
    font-style: italic;
  }

  .toc-item {
    background: transparent;
    border: none;
    outline: none;
    text-align: left;
    padding: 0.4rem 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    transition: all var(--transition-fast);
    line-height: 1.3;
  }

  .toc-item:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .toc-bullet {
    margin-right: 0.4rem;
    color: var(--text-muted);
  }

  .toc-item.level-1 { padding-left: 0.5rem; font-weight: 500; }
  .toc-item.level-2 { padding-left: 1.25rem; }
  .toc-item.level-3 { padding-left: 2rem; font-size: 0.8rem; }
  .toc-item.level-4 { padding-left: 2.75rem; font-size: 0.8rem; }
  .toc-item.level-5 { padding-left: 3.5rem; font-size: 0.8rem; }
  .toc-item.level-6 { padding-left: 4.25rem; font-size: 0.8rem; }

  .resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 5px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
    transition: background-color var(--transition-fast);
  }

  .resize-handle:hover,
  .resize-handle:active {
    background-color: var(--accent-primary);
  }

  :global([dir="rtl"]) .resize-handle {
    right: auto;
    left: 0;
  }

  .sidebar.side-right .resize-handle {
    right: auto;
    left: 0;
  }

  .sidebar.side-right .resize-handle:hover,
  .sidebar.side-right .resize-handle:active {
    background-color: var(--accent-primary);
  }
</style>
