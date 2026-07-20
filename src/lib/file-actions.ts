import { openFileInTab } from '../stores/content';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

export async function openFileByPath(filePath: string): Promise<boolean> {
  try {
    const content = await invoke<string>('read_file_raw', { path: filePath });
    const name = filePath.split(/[/\\]/).pop() || 'document.md';
    openFileInTab(content, filePath, name);
    return true;
  } catch (err) {
    console.error('Failed to open file:', err);
    return false;
  }
}

export async function handleOpen(): Promise<boolean> {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Markdown',
        extensions: ['md', 'markdown', 'txt']
      }]
    });

    if (selected && typeof selected === 'string') {
      const content = await readTextFile(selected);
      const name = selected.split(/[/\\]/).pop() || 'document.md';

      openFileInTab(content, selected, name);
      return true;
    }
  } catch (err) {
    console.error('Failed to open file:', err);
    alert('Error opening file: ' + err);
  }
  return false;
}
