<script lang="ts">
  import { onMount } from 'svelte';
  import { theme, zoom, sidebarOpen, rtl, showHelp, previewTheme, sidebarSide } from '../stores/config';
  import { locale, t } from '../lib/i18n';
  import { handleOpen, reloadActiveFile } from '../lib/file-actions';
  import { showPrintDialog } from '../stores/print';
  import PrintDialog from './PrintDialog.svelte';

  function toggleTheme() {
    theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  function zoomIn() {
    zoom.update(z => Math.min(3.0, z + 0.1));
  }

  function zoomOut() {
    zoom.update(z => Math.max(0.5, z - 0.1));
  }

  function zoomReset() {
    zoom.set(1.0);
  }

  function onZoomInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = parseInt(input.value);
    if (!isNaN(v)) {
      zoom.set(Math.max(0.5, Math.min(3.0, v / 100)));
    }
  }

  function toggleLocale() {
    locale.update(l => {
      if (l === 'en') return 'es';
      if (l === 'es') return 'pt';
      return 'en';
    });
  }

  function handlePrint() {
    showPrintDialog.set(true);
  }

  onMount(() => {
    const handleOpenShortcut = () => handleOpen();
    window.addEventListener('arty-open', handleOpenShortcut);
    return () => {
      window.removeEventListener('arty-open', handleOpenShortcut);
    };
  });
</script>

<header class="header glass">
  <div class="header-left">
    <button
      class="icon-btn sidebar-toggle"
      class:active={$sidebarOpen}
      onclick={() => sidebarOpen.update(o => !o)}
      title={t('toggleSidebar', $locale)}
      aria-label="Toggle Sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    </button>

    <button
      class="icon-btn sidebar-side-toggle"
      onclick={() => sidebarSide.update(s => s === 'left' ? 'right' : 'left')}
      title={t('toggleSidebarSide', $locale)}
      aria-label="Toggle TOC Side"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        {#if $sidebarSide === 'left'}
          <line x1="9" y1="3" x2="9" y2="21" />
          <path d="M13 12h5m-2-2l2 2-2 2" />
        {:else}
          <line x1="15" y1="3" x2="15" y2="21" />
          <path d="M11 12H6m2-2L6 12l2 2" />
        {/if}
      </svg>
    </button>

    <button class="icon-btn" onclick={handleOpen} title={t('openFile', $locale)} aria-label="Open File">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    </button>

    <button class="icon-btn" onclick={reloadActiveFile} title={t('reloadFile', $locale)} aria-label="Reload Active File">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6"></path>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    </button>

    <button class="icon-btn" onclick={handlePrint} title={t('print', $locale)} aria-label="Print">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
      </svg>
    </button>

    <button class="icon-btn" onclick={() => window.dispatchEvent(new CustomEvent('arty-find'))} title={t('findPlaceholder', $locale)} aria-label="Find in document">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>

    <button class="icon-btn" onclick={toggleTheme} title={$theme === 'dark' ? t('themeLight', $locale) : t('themeDark', $locale)} aria-label="Toggle Theme">
      {#if $theme === 'dark'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      {/if}
    </button>

    <button
      class="icon-btn"
      onclick={() => showHelp.set(true)}
      title={t('helpTitle', $locale)}
      aria-label="Help"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>

    <button class="locale-btn" onclick={toggleLocale} title="Switch Language">
      {$locale.toUpperCase()}
    </button>
  </div>

  <div class="header-right">
    <div class="zoom-controls">
      <button class="icon-btn zoom-btn" onclick={zoomOut} title={t('zoomOut', $locale)} aria-label="Zoom Out">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <input
        class="zoom-value"
        type="number"
        min="50"
        max="300"
        value={Math.round($zoom * 100)}
        onchange={onZoomInput}
        onfocus={(e) => (e.target as HTMLInputElement).select()}
        ondblclick={zoomReset}
        title={t('zoomReset', $locale)}
      />
      <button class="icon-btn zoom-btn" onclick={zoomIn} title={t('zoomIn', $locale)} aria-label="Zoom In">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
    </div>

    <div class="vertical-divider"></div>

    <button
      class="icon-btn"
      class:active={$rtl}
      onclick={() => rtl.update(r => !r)}
      title={t('toggleRTL', $locale)}
      aria-label="Toggle RTL"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 5h10M6 9h10M6 13h14M6 17h14" />
      </svg>
    </button>

    <div class="vertical-divider"></div>

    <select
      class="preview-theme-select glass"
      bind:value={$previewTheme}
      title="Preview Theme"
    >
      <option value="default">{t('themeDefault', $locale)}</option>
      <option value="github">{t('themeGithub', $locale)}</option>
      <option value="academic">{t('themeAcademic', $locale)}</option>
      <option value="minimal">{t('themeMinimal', $locale)}</option>
        <option value="neutral">{t('themeNeutral', $locale)}</option>
        <option value="arty">{t('themeArty', $locale)}</option>
      </select>
  </div>
</header>

<PrintDialog />

<style>
  .header {
    height: var(--header-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 100;
    user-select: none;
    transition: background-color var(--transition-normal), border-color var(--transition-normal);
  }

  .header-left, .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-right {
    gap: 0.75rem;
  }

  .vertical-divider {
    width: 1px;
    height: 20px;
    background-color: var(--border-color);
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 2px;
  }

  .zoom-value {
    background: transparent;
    border: none;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    width: 45px;
    text-align: center;
    color: var(--text-secondary);
    cursor: pointer;
    outline: none;
    padding: 0;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .zoom-value::-webkit-inner-spin-button,
  .zoom-value::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .zoom-value:focus {
    color: var(--text-primary);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    outline: none;
  }

  .icon-btn:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border-color: var(--border-color);
  }

  .sidebar-toggle.active {
    color: var(--accent-primary);
    background: var(--accent-light);
    border-color: var(--border-active);
  }

  .locale-btn {
    background: transparent;
    border: none;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    outline: none;
  }

  .locale-btn:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .preview-theme-select {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 0.8rem;
    padding: 0.35rem 0.5rem;
    outline: none;
    cursor: pointer;
    font-weight: 500;
    transition: all var(--transition-fast);
    font-family: var(--font-sans);
    forced-color-adjust: none;
    color-scheme: light;
  }

  :global(.dark) .preview-theme-select {
    color-scheme: dark;
  }

  .preview-theme-select:hover {
    border-color: var(--border-active);
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }


</style>
