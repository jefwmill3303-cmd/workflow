import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEditorStore } from '../stores/editorStore.js';
import { ExportPanel } from './ExportPanel.js';

// ── Save indicator ─────────────────────────────────────────────────────────────
function SaveIndicator() {
  const saveStatus  = useEditorStore((s) => s.saveStatus);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const isDirty     = useEditorStore((s) => s.isDirty);

  if (saveStatus === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Saving…
      </div>
    );
  }

  if (saveStatus === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Save failed
      </div>
    );
  }

  if (saveStatus === 'saved' && lastSavedAt) {
    const mins = Math.floor((Date.now() - lastSavedAt) / 60000);
    const label = mins < 1 ? 'just now' : `${mins}m ago`;
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Saved {label}
      </div>
    );
  }

  if (isDirty) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        Unsaved
      </div>
    );
  }

  return null;
}

// ── Inline project name ───────────────────────────────────────────────────────
function ProjectNameEdit() {
  const project           = useEditorStore((s) => s.project);
  const updateProjectName = useEditorStore((s) => s.updateProjectName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef              = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(project?.name ?? 'Untitled Project');
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== project?.name) {
      updateProjectName(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
          e.stopPropagation(); // prevent global shortcuts
        }}
        className="text-sm font-medium text-gray-200 bg-gray-700 border border-indigo-500 rounded px-2 py-0.5 max-w-48 focus:outline-none"
        maxLength={80}
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      title="Click to rename project"
      className="text-sm text-gray-200 font-medium truncate max-w-48 hover:text-white hover:underline decoration-dotted underline-offset-2 transition-colors"
    >
      {project?.name ?? 'Untitled Project'}
    </button>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
export function Toolbar() {
  const activeTool    = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Back */}
      <Link
        to="/"
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
        title="Back to home"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </Link>

      <div className="w-px h-5 bg-gray-700" />

      {/* Logo */}
      <span className="text-indigo-400 font-bold text-sm tracking-tight">ClipFlow</span>

      <div className="w-px h-5 bg-gray-700" />

      {/* Project name (inline-editable) */}
      <ProjectNameEdit />

      {/* Save indicator */}
      <SaveIndicator />

      <div className="flex-1" />

      {/* Canvas tool group */}
      <div className="flex items-center gap-1 bg-gray-900 rounded-md p-1">
        <button
          title="Select (V)"
          onClick={() => setActiveTool('select')}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            activeTool === 'select'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l7 7m0 0l7 7M10 10l7-7M10 10L3 17" />
          </svg>
        </button>

        {/* Split tool */}
        <button
          title="Split clip at playhead (S)"
          onClick={() => setActiveTool(activeTool === 'split' ? 'select' : 'split')}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            activeTool === 'split'
              ? 'bg-orange-600 text-white'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="6" cy="6" r="2.5" strokeWidth={1.5} />
            <circle cx="6" cy="18" r="2.5" strokeWidth={1.5} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8.12 8.12L20 20M8.12 15.88L20 4" />
          </svg>
        </button>

        <button
          title="Text (T)"
          onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            activeTool === 'text'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7V5h16v2M9 5v14m6-14v14M7 19h10" />
          </svg>
        </button>
      </div>

      <div className="flex-1" />

      {/* Export */}
      <button
        onClick={() => setExportOpen(true)}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors"
        title="Export video (Ctrl+E)"
      >
        Export
      </button>

      {exportOpen && <ExportPanel onClose={() => setExportOpen(false)} />}
    </div>
  );
}
