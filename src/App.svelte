<script lang="ts">
  import Header from './components/Header.svelte';
  import TabBar from './components/TabBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ViewerContainer from './components/ViewerContainer.svelte';
  import DefaultAppPrompt from './components/DefaultAppPrompt.svelte';
  import { theme } from './stores/config';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { openFileByPath } from './lib/file-actions';
  import { loadSession } from './stores/content';

  let showDefaultPrompt = $state(false);

  onMount(() => {
    if ($theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const handleWheelGlobal = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    const handleTouchMoveGlobal = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', handleWheelGlobal, { passive: false });
    window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });

    const dismissed = localStorage.getItem('defaultPromptDismissed');
    if (dismissed !== 'true') {
      showDefaultPrompt = true;
    }

    // Check for pending files passed via command-line / file association BEFORE
    // restoring the session, so they take priority on the very first launch.
    invoke<string[]>('get_pending_files').then(async files => {
      if (files.length > 0) {
        for (const filePath of files) {
          const ok = await openFileByPath(filePath);
          if (!ok) {
            console.error('Failed to load file from command-line arg:', filePath);
          }
        }
      } else {
        // No pending files — restore the previous session instead.
        loadSession();
      }
    }).catch(err => {
      console.error('Failed to get pending files:', err);
      // Fall back to session restore if the invoke fails.
      loadSession();
    });

    let unlisten: (() => void) | null = null;
    listen<string[]>('open-files', async event => {
      const files = event.payload;
      for (const filePath of files) {
        const ok = await openFileByPath(filePath);
        if (!ok) {
          console.error('Failed to load file from single-instance event:', filePath);
        }
      }
    }).then(fn => {
      unlisten = fn;
    });

    return () => {
      window.removeEventListener('wheel', handleWheelGlobal);
      window.removeEventListener('touchmove', handleTouchMoveGlobal);
      if (unlisten) {
        unlisten();
      }
    };
  });

  function onDefaultPromptDismiss() {
    showDefaultPrompt = false;
  }
</script>

<div class="app-layout">
  <Header />
  <TabBar />

  <div class="main-content">
    <Sidebar />
    <main class="content-viewport">
      <ViewerContainer />
    </main>
  </div>

  <DefaultAppPrompt visible={showDefaultPrompt} onDismiss={onDefaultPromptDismiss} />
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: var(--bg-primary);
    transition: background-color var(--transition-normal);
  }

  .main-content {
    display: flex;
    flex-direction: row;
    height: calc(100vh - var(--header-height) - var(--tabbar-height));
    width: 100%;
    overflow: hidden;
  }

  .content-viewport {
    flex-grow: 1;
    height: 100%;
    overflow: hidden;
    position: relative;
  }
</style>
