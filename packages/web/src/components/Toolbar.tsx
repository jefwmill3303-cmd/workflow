import { Link } from 'react-router-dom';
import { useEditorStore } from '../stores/editorStore.js';

export function Toolbar() {
  const project    = useEditorStore((s) => s.project);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

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

      {/* Project name */}
      <span className="text-sm text-gray-200 font-medium truncate max-w-48">
        {project?.name ?? 'Untitled Project'}
      </span>

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
          {/* Scissors icon */}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="6" cy="6" r="2.5" strokeWidth={1.5} />
            <circle cx="6" cy="18" r="2.5" strokeWidth={1.5} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8.12 8.12L20 20M8.12 15.88L20 4" />
          </svg>
        </button>

        <button
          title="Text"
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h8m-8 6h16" />
          </svg>
        </button>
      </div>

      <div className="flex-1" />

      {/* Export */}
      <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors">
        Export
      </button>
    </div>
  );
}
