import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore.js';

const FRAME_DUR = 1 / 30; // 30fps frame duration in seconds

interface Options {
  onShowShortcuts: () => void;
  onSave: () => void;
}

function isInputTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (e.target as HTMLElement)?.isContentEditable
  );
}

export function useKeyboardShortcuts({ onShowShortcuts, onSave }: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key   = e.key;

      // ── Ctrl combos (work in inputs) ──────────────────────────────────────
      if (ctrl) {
        if (key === 'z' && !shift) {
          e.preventDefault();
          useEditorStore.getState().undo();
          return;
        }
        if ((key === 'z' && shift) || key === 'y') {
          e.preventDefault();
          useEditorStore.getState().redo();
          return;
        }
        if (key === 's') {
          e.preventDefault();
          onSave();
          return;
        }
        return; // Don't intercept other Ctrl shortcuts
      }

      // ── Keys that work in inputs ──────────────────────────────────────────
      if (key === 'Escape') {
        useEditorStore.getState().setActiveTool('select');
        return;
      }

      // ── Skip remaining if focused on an input ─────────────────────────────
      if (isInputTarget(e)) return;

      const store = useEditorStore.getState();

      switch (key) {
        case ' ':
          e.preventDefault();
          store.setPlaying(!store.playback.playing);
          break;

        case 'k':
        case 'K':
          e.preventDefault();
          store.setPlaying(false);
          break;

        case 'j':
        case 'J': {
          e.preventDefault();
          store.setPlaying(false);
          const t = Math.max(0, store.playback.currentTime - 5);
          store.setCurrentTime(t);
          break;
        }

        case 'l':
        case 'L': {
          e.preventDefault();
          const t2 = Math.min(store.playback.duration, store.playback.currentTime + 5);
          store.setCurrentTime(t2);
          if (!store.playback.playing) store.setPlaying(true);
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          const nudge = shift ? FRAME_DUR : 1;
          store.setCurrentTime(Math.max(0, store.playback.currentTime - nudge));
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const nudge2 = shift ? FRAME_DUR : 1;
          store.setCurrentTime(Math.min(store.playback.duration, store.playback.currentTime + nudge2));
          break;
        }

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          store.deleteSelected();
          break;

        case 't':
        case 'T':
          store.setActiveTool('text');
          break;

        case 's':
        case 'S':
          store.setActiveTool('split');
          break;

        case 'v':
        case 'V':
          store.setActiveTool('select');
          break;

        case '?':
          onShowShortcuts();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onShowShortcuts, onSave]);
}
