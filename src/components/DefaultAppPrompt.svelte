<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { locale, t } from '../lib/i18n';

  let { visible = false, onDismiss }: { visible: boolean; onDismiss?: () => void } = $props();

  async function handleYes() {
    try {
      const result = await invoke<string>('set_default_markdown_handler');
      console.log(result);
    } catch (err) {
      console.error('Failed to set default handler:', err);
    }
    onDismiss?.();
  }

  function handleNo() {
    onDismiss?.();
  }

  function handleDontAsk() {
    localStorage.setItem('defaultPromptDismissed', 'true');
    onDismiss?.();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="prompt-title" onclick={handleNo} onkeydown={(e) => { if (e.key === 'Escape') handleNo(); }}>
    <div class="prompt-dialog glass" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') handleNo(); }}>
      <div class="prompt-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" class="prompt-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <h3 id="prompt-title">{t('defaultPromptTitle', $locale)}</h3>
      </div>

      <p class="prompt-message">{t('defaultPromptMessage', $locale)}</p>

      <div class="prompt-actions">
        <button class="btn btn-primary" onclick={handleYes}>{t('defaultPromptYes', $locale)}</button>
        <button class="btn btn-secondary" onclick={handleNo}>{t('defaultPromptNo', $locale)}</button>
        <button class="btn btn-ghost" onclick={handleDontAsk}>{t('defaultPromptDontAsk', $locale)}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .prompt-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.15s ease-out;
  }

  .prompt-dialog {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    width: 420px;
    max-width: 90%;
    box-shadow: var(--shadow-lg);
    animation: slideIn 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
  }

  .prompt-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .prompt-icon {
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .prompt-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .prompt-message {
    margin: 0 0 1.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .prompt-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border-color);
    outline: none;
    transition: all var(--transition-fast);
    font-family: var(--font-sans);
  }

  .btn-primary {
    background: var(--accent-primary);
    color: white;
    border-color: var(--accent-primary);
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .btn-ghost:hover {
    color: var(--text-secondary);
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
