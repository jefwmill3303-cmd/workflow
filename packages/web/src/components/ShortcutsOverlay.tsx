interface ShortcutsOverlayProps {
  onClose: () => void;
}

const SHORTCUTS: Array<{ key: string; description: string; group?: string }> = [
  { group: 'Playback', key: 'Space',      description: 'Play / Pause' },
  { key: 'K',          description: 'Pause' },
  { key: 'J',          description: 'Step back 5 seconds' },
  { key: 'L',          description: 'Step forward 5 seconds (also plays)' },
  { key: '← →',        description: 'Nudge playhead ±1 second' },
  { key: 'Shift ← →',  description: 'Nudge playhead ±1 frame (30fps)' },

  { group: 'Tools',    key: 'V',          description: 'Select tool' },
  { key: 'T',          description: 'Text tool' },
  { key: 'S',          description: 'Split tool' },
  { key: 'Esc',        description: 'Back to Select tool' },

  { group: 'Edit',     key: 'Del / Backspace', description: 'Delete selected clip or object' },
  { key: 'Ctrl+Z',     description: 'Undo' },
  { key: 'Ctrl+Shift+Z', description: 'Redo' },
  { key: 'Ctrl+S',     description: 'Save project' },

  { group: 'View',     key: '?',          description: 'Show this shortcuts overlay' },
  { key: 'Ctrl+Scroll', description: 'Zoom timeline in / out' },
];

export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[440px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-100">Keyboard Shortcuts</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {(() => {
            let currentGroup = '';
            return SHORTCUTS.map((s, i) => {
              const showHeader = s.group && s.group !== currentGroup;
              if (s.group) currentGroup = s.group;
              return (
                <div key={i}>
                  {showHeader && (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1.5 first:mt-0">
                      {s.group}
                    </p>
                  )}
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                    <span className="text-xs text-gray-300">{s.description}</span>
                    <kbd className="text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-0.5 font-mono flex-shrink-0 ml-4">
                      {s.key}
                    </kbd>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        <div className="px-5 py-3 border-t border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-600 text-center">Press <kbd className="bg-gray-800 border border-gray-700 rounded px-1 text-gray-400 font-mono">?</kbd> or <kbd className="bg-gray-800 border border-gray-700 rounded px-1 text-gray-400 font-mono">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
