import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Toolbar } from '../components/Toolbar.js';
import { MediaLibrary } from '../components/MediaLibrary.js';
import { VideoCanvas } from '../components/VideoCanvas.js';
import { PropertiesPanel } from '../components/PropertiesPanel.js';
import { TimelinePanel } from '../components/TimelinePanel.js';
import { useEditorStore } from '../stores/editorStore.js';
import type { MediaFile } from '../stores/editorStore.js';

interface ProjectResponse {
  data?: Array<{ id: string; name: string }>;
}

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const setProject = useEditorStore((s) => s.setProject);
  const requestLoadMedia = useEditorStore((s) => s.requestLoadMedia);

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

  const handleFileClick = (file: MediaFile) => {
    if (file.type === 'VIDEO' || file.type === 'IMAGE') {
      requestLoadMedia(file);
    }
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

      {/* ── Bottom — Timeline ─────────────────────────────────────────────── */}
      <TimelinePanel />
    </div>
  );
}

