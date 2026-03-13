import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Toolbar } from '../components/Toolbar.js';
import { MediaLibrary } from '../components/MediaLibrary.js';
import { VideoCanvas } from '../components/VideoCanvas.js';
import { PropertiesPanel } from '../components/PropertiesPanel.js';
import { TimelinePanel } from '../components/TimelinePanel.js';
import { AudioMixerPanel } from '../components/AudioMixerPanel.js';
import { ShortcutsOverlay } from '../components/ShortcutsOverlay.js';
import { useEditorStore } from '../stores/editorStore.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import type { MediaFile } from '../stores/editorStore.js';

const AUTOSAVE_INTERVAL_MS = 30_000;

interface ProjectResponse {
  data?: Array<{ id: string; name: string }>;
}

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const setProject       = useEditorStore((s) => s.setProject);
  const requestLoadMedia = useEditorStore((s) => s.requestLoadMedia);
  const isDirty          = useEditorStore((s) => s.isDirty);
  const setSaveStatus    = useEditorStore((s) => s.setSaveStatus);
  const setLastSavedAt   = useEditorStore((s) => s.setLastSavedAt);
  const project          = useEditorStore((s) => s.project);
  const timelineTracks   = useEditorStore((s) => s.timelineTracks);
  const textObjects      = useEditorStore((s) => s.textObjects);
  const mixerTracks      = useEditorStore((s) => s.mixerTracks);
  const clipFades        = useEditorStore((s) => s.clipFades);

  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    fetch('/api/projects')
      .then((r) => r.json())
      .then((json: ProjectResponse) => {
        const found = json.data?.find((p) => p.id === projectId) ?? null;
        setProject(found ?? null);
      })
      .catch(() => setProject(null));
  }, [projectId, setProject]);

  // ── Save project ──────────────────────────────────────────────────────────
  const saveProject = useCallback(async () => {
    if (!projectId || !project) return;
    setSaveStatus('saving');
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.name,
          timeline_data: { timelineTracks, textObjects, mixerTracks, clipFades },
        }),
      });
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      useEditorStore.setState({ isDirty: false });
    } catch {
      setSaveStatus('error');
    }
  }, [projectId, project, timelineTracks, textObjects, mixerTracks, clipFades, setSaveStatus, setLastSavedAt]);

  // Auto-save every 30s when dirty
  useEffect(() => {
    if (!isDirty || !projectId) return;
    const timer = setTimeout(() => void saveProject(), AUTOSAVE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isDirty, projectId, saveProject]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({
    onShowShortcuts: () => setShowShortcuts(true),
    onSave: () => void saveProject(),
  });

  // Close shortcuts overlay with Escape
  useEffect(() => {
    if (!showShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showShortcuts]);

  const handleFileClick = (file: MediaFile) => {
    requestLoadMedia(file); // VIDEO, AUDIO, and IMAGE all load via VideoCanvas
  };

  if (!projectId) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No project ID provided.</p>
          <Link to="/" className="text-indigo-400 hover:text-indigo-300 underline text-sm">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* ── Top toolbar ───────────────────────────────────────────────────── */}
      <Toolbar />

      {/* ── Middle row: left sidebar + canvas + right sidebar ────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar — Media Library */}
        <aside className="w-56 flex-shrink-0 border-r border-gray-700 overflow-hidden">
          <MediaLibrary
            projectId={projectId}
            onFileClick={handleFileClick}
          />
        </aside>

        {/* Center — Canvas + playback controls */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <VideoCanvas />
        </main>

        {/* Right sidebar — Inspector / Properties */}
        <aside className="w-56 flex-shrink-0 overflow-hidden">
          <PropertiesPanel />
        </aside>
      </div>

      {/* ── Audio Mixer ───────────────────────────────────────────────────── */}
      <AudioMixerPanel />

      {/* ── Bottom — Timeline ─────────────────────────────────────────────── */}
      <TimelinePanel />

      {/* ── Shortcuts overlay ─────────────────────────────────────────────── */}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
