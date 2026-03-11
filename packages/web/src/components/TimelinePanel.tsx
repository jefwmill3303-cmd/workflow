import { useEditorStore } from '../stores/editorStore.js';

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const TRACK_COLORS: Record<string, string> = {
  VIDEO: 'bg-indigo-700 border-indigo-500',
  IMAGE: 'bg-yellow-700 border-yellow-500',
  AUDIO: 'bg-green-700 border-green-500',
};

export function TimelinePanel() {
  const canvasObjects = useEditorStore((s) => s.canvasObjects);
  const playback = useEditorStore((s) => s.playback);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);

  const playheadPct =
    playback.duration > 0 ? (playback.currentTime / playback.duration) * 100 : 0;

  return (
    <div className="flex-shrink-0 bg-gray-900 border-t border-gray-700 flex flex-col" style={{ height: '9rem' }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 h-8 border-b border-gray-700 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Timeline
        </span>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 font-mono tabular-nums">
          {formatTime(playback.currentTime)}
          <span className="text-gray-700 mx-1">/</span>
          {formatTime(playback.duration)}
        </span>
      </div>

      {/* Track area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {canvasObjects.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-700">Add media to the canvas to see tracks</p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Track labels */}
            <div className="w-28 flex-shrink-0 border-r border-gray-800 py-1 space-y-1">
              {canvasObjects.map((obj) => (
                <div
                  key={obj.id}
                  className={`h-7 flex items-center px-2 cursor-pointer rounded-sm mx-1 transition-colors ${
                    selectedObjectId === obj.id ? 'bg-gray-700' : 'hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedObjectId(obj.id)}
                >
                  <span className="text-xs text-gray-400 truncate" title={obj.filename}>
                    {obj.filename}
                  </span>
                </div>
              ))}
            </div>

            {/* Track lanes */}
            <div className="flex-1 relative py-1 space-y-1">
              {/* Playhead */}
              {playback.duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                  style={{ left: `${playheadPct}%` }}
                />
              )}

              {canvasObjects.map((obj) => (
                <div key={obj.id} className="h-7 mx-1 relative">
                  <div
                    className={`absolute inset-y-0 left-0 right-0 rounded border ${
                      TRACK_COLORS[obj.type] ?? 'bg-gray-700 border-gray-500'
                    } cursor-pointer opacity-90 hover:opacity-100 transition-opacity`}
                    onClick={() => setSelectedObjectId(obj.id)}
                  >
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-white/80 truncate font-medium">
                      {obj.filename}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
