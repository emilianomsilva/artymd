<script lang="ts">
  import { showPrintDialog, printPaper, printOrientation, printMargin, printPageNumbers } from '../stores/print';
  import { previewTheme, theme } from '../stores/config';
  import { currentFileText } from '../stores/content';
  import { renderMarkdown } from '../lib/renderer';
  import { openPrintWindow } from '../lib/print-pipeline';
  import { locale, t } from '../lib/i18n';

  let paper = $state($printPaper);
  let orientation = $state($printOrientation);
  let margin = $state($printMargin);
  let showNumbers = $state($printPageNumbers);

  function handlePrint() {
    printPaper.set(paper);
    printOrientation.set(orientation);
    printMargin.set(margin);
    printPageNumbers.set(showNumbers);

    const el = document.querySelector('.markdown-body');
    const html = el ? el.innerHTML : renderMarkdown($currentFileText);
    openPrintWindow(html, {
      paper,
      orientation: orientation as 'portrait' | 'landscape',
      marginMm: margin,
      showPageNumbers: showNumbers,
      theme: $previewTheme,
      darkMode: $theme === 'dark'
    });
    showPrintDialog.set(false);
  }

  function handleCancel() {
    showPrintDialog.set(false);
  }
</script>

{#if $showPrintDialog}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="print-overlay" role="dialog" aria-modal="true" aria-labelledby="print-dialog-title" onclick={handleCancel} onkeydown={(e) => { if (e.key === 'Escape') handleCancel(); }}>
    <div class="print-dialog glass" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') handleCancel(); }}>
      <div class="dialog-header">
        <h3 id="print-dialog-title">{t('printSettings', $locale)}</h3>
        <button class="close-btn" onclick={handleCancel}>&times;</button>
      </div>

      <div class="dialog-body">
        <label class="field">
          <span class="field-label">{t('paperSize', $locale)}</span>
          <select bind:value={paper}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="A3">A3</option>
            <option value="A5">A5</option>
            <option value="Legal">Legal</option>
            <option value="B5">B5</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">{t('orientation', $locale)}</span>
          <select bind:value={orientation}>
            <option value="portrait">{t('portrait', $locale)}</option>
            <option value="landscape">{t('landscape', $locale)}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">{t('margin', $locale)}</span>
          <div class="margin-row">
            <input type="range" min="5" max="30" bind:value={margin} />
            <span class="margin-value">{margin}mm</span>
          </div>
        </label>

        <label class="field field-row">
          <input type="checkbox" bind:checked={showNumbers} />
          <span class="field-label">{t('pageNumbers', $locale)}</span>
        </label>
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick={handleCancel}>{t('cancel', $locale)}</button>
        <button class="btn btn-primary" onclick={handlePrint}>{t('print', $locale)}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .print-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  .print-dialog {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    width: 380px;
    max-width: 90%;
    box-shadow: var(--shadow-lg);
    animation: slideIn 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
  }

  .close-btn:hover { color: var(--text-primary); }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .field-row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .field-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .field select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    color: var(--text-primary);
    outline: none;
    cursor: pointer;
    forced-color-adjust: none;
    color-scheme: light;
  }

  :global(.dark) .field select {
    color-scheme: dark;
  }



  .margin-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .margin-row input[type="range"] {
    flex-grow: 1;
    accent-color: var(--accent-primary);
  }

  .margin-value {
    font-size: 0.85rem;
    font-family: var(--font-mono);
    color: var(--text-primary);
    min-width: 40px;
    text-align: right;
  }

  .field-row input[type="checkbox"] {
    accent-color: var(--accent-primary);
    width: 16px; height: 16px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
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
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .btn-primary {
    background: var(--accent-primary);
    color: white;
    border-color: var(--accent-primary);
  }

  .btn-primary:hover {
    background: var(--accent-hover);
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
