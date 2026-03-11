import { Link } from 'react-router-dom';
import { useEditorStore } from '../stores/editorStore.js';

export function Toolbar() {
  const project = useEditorStore((s) => s.project);

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

      {/* Tool group */}
      <div className="flex items-center gap-1 bg-gray-900 rounded-md p-1">
        {[
          { label: 'Select', icon: 'M3 3l7 7m0 0l7 7M10 10l7-7M10 10L3 17' },
          { label: 'Text', icon: 'M4 6h16M4 12h8m-8 6h16' },
          { label: 'Shape', icon: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z' },
        ].map(({ label, icon }) => (
          <button
            key={label}
            title={label}
            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
            </svg>
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Export */}
      <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors">
        Export
      </button>
    </div>
  );
}
