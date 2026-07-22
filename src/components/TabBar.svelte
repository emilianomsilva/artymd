<script lang="ts">
  import { tabsList, activeTabId, switchTab, closeTab, createNewTab, detachTab, reattachTab } from '../stores/content';

  let tabBarElement = $state<HTMLDivElement | null>(null);

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isDetachedWindow = urlParams?.get('detached') === 'true';

  async function handleCloseTab(tabId: string) {
    await closeTab(tabId);
  }

  async function handleDetachTab(tabId: string) {
    await detachTab(tabId);
  }

  async function handleReattachTab(tabId: string) {
    await reattachTab(tabId);
  }

  function handleDragStart(e: DragEvent, tabId: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', tabId);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragEnd(e: DragEvent, tabId: string) {
    if (!tabBarElement) return;
    const rect = tabBarElement.getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;

    if (isOutside) {
      if (isDetachedWindow) {
        handleReattachTab(tabId);
      } else {
        handleDetachTab(tabId);
      }
    }
  }
</script>

<div class="tab-bar" bind:this={tabBarElement}>
  <div class="tabs-scroll">
    {#each $tabsList as tab (tab.id)}
      <button
        class="tab-item"
        class:active={$activeTabId === tab.id}
        draggable="true"
        ondragstart={(e) => handleDragStart(e, tab.id)}
        ondragend={(e) => handleDragEnd(e, tab.id)}
        onclick={() => switchTab(tab.id)}
        title={tab.path || tab.name}
      >
        <span class="tab-label">{tab.name}</span>
        {#if isDetachedWindow}
          <span
            class="tab-action tab-reattach"
            role="button"
            tabindex="-1"
            title="Re-attach to main window"
            onclick={(e) => { e.stopPropagation(); handleReattachTab(tab.id); }}
            onkeydown={(e) => { if (e.key === 'Enter') handleReattachTab(tab.id); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 11V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-6"></path>
              <polyline points="13 13 8 18 3 13"></polyline>
              <line x1="8" y1="18" x2="8" y2="7"></line>
            </svg>
          </span>
        {:else}
          <span
            class="tab-action tab-detach"
            role="button"
            tabindex="-1"
            title="Detach into new window"
            onclick={(e) => { e.stopPropagation(); handleDetachTab(tab.id); }}
            onkeydown={(e) => { if (e.key === 'Enter') handleDetachTab(tab.id); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </span>
        {/if}
        <span
          class="tab-action tab-close"
          role="button"
          tabindex="-1"
          title="Close tab"
          onclick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
          onkeydown={(e) => { if (e.key === 'Enter') handleCloseTab(tab.id); }}
        >&times;</span>
      </button>
    {/each}
    <button class="new-tab-btn" onclick={() => createNewTab()} title="New Tab" aria-label="New Tab">+</button>
  </div>
</div>

<style>
  .tab-bar {
    height: var(--tabbar-height);
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    user-select: none;
    flex-shrink: 0;
    overflow: hidden;
  }

  .tabs-scroll {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 0.25rem;
    overflow-x: auto;
    flex-grow: 1;
    height: 100%;
    scrollbar-width: none;
  }

  .tabs-scroll::-webkit-scrollbar {
    display: none;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 32px;
    padding: 0 0.5rem 0 0.75rem;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    border-radius: 6px 6px 0 0;
    cursor: grab;
    outline: none;
    white-space: nowrap;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .tab-item:active {
    cursor: grabbing;
  }

  .tab-item:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border-color: var(--border-color);
  }

  .tab-item.active {
    color: var(--accent-primary);
    background: var(--bg-primary);
    border-color: var(--border-color);
    border-bottom-color: var(--bg-primary);
    font-weight: 500;
  }

  .tab-label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    font-size: 0.9rem;
    line-height: 1;
    color: var(--text-muted);
    transition: all var(--transition-fast);
    opacity: 0.6;
  }

  .tab-action:hover {
    opacity: 1;
    color: var(--text-primary);
    background: rgba(0, 0, 0, 0.08);
  }

  :global(.dark) .tab-action:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .new-tab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px dashed var(--border-color);
    background: transparent;
    color: var(--text-muted);
    font-size: 1.1rem;
    font-weight: 500;
    cursor: pointer;
    margin-left: 0.5rem;
    align-self: center;
    transition: all var(--transition-fast);
    outline: none;
    flex-shrink: 0;
  }

  .new-tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border-color: var(--border-active);
  }
</style>
