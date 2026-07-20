<script lang="ts">
  import { tabsList, activeTabId, switchTab, closeTab, createNewTab } from '../stores/content';

  async function handleCloseTab(tabId: string) {
    await closeTab(tabId);
  }
</script>

<div class="tab-bar">
  <div class="tabs-scroll">
    {#each $tabsList as tab (tab.id)}
      <button
        class="tab-item"
        class:active={$activeTabId === tab.id}
        onclick={() => switchTab(tab.id)}
        title={tab.path || tab.name}
      >
        <span class="tab-label">{tab.name}</span>
        <span
          class="tab-close"
          role="button"
          tabindex="-1"
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
    cursor: pointer;
    outline: none;
    white-space: nowrap;
    transition: all var(--transition-fast);
    flex-shrink: 0;
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

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    font-size: 1rem;
    line-height: 1;
    color: var(--text-muted);
    transition: all var(--transition-fast);
  }

  .tab-close:hover {
    color: var(--text-primary);
    background: rgba(0, 0, 0, 0.08);
  }

  :global(.dark) .tab-close:hover {
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
