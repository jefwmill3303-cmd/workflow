import { useEditorStore } from '../stores/editorStore.js';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-200 font-mono">{value}</span>
    </div>
  );
}

export function PropertiesPanel() {
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const canvasObjects = useEditorStore((s) => s.canvasObjects);
  const selected = canvasObjects.find((o) => o.id === selectedObjectId);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Inspector
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!selected ? (
          <div className="mt-12 text-center">
            <svg
              className="w-8 h-8 text-gray-700 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
              />
            </svg>
            <p className="text-xs text-gray-600">Click an object to inspect</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Type badge */}
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  selected.type === 'VIDEO'
                    ? 'bg-indigo-900/60 text-indigo-300'
                    : selected.type === 'IMAGE'
                    ? 'bg-yellow-900/60 text-yellow-300'
                    : 'bg-green-900/60 text-green-300'
                }`}
              >
                {selected.type}
              </span>
              <span className="text-xs text-gray-300 font-medium truncate" title={selected.filename}>
                {selected.filename}
              </span>
            </div>

            {/* Transform */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Transform</p>
              <div className="bg-gray-800 rounded-md px-2 divide-y divide-gray-700/50">
                <Row label="X" value={Math.round(selected.x)} />
                <Row label="Y" value={Math.round(selected.y)} />
                <Row
                  label="W"
                  value={Math.round(selected.width * selected.scaleX)}
                />
                <Row
                  label="H"
                  value={Math.round(selected.height * selected.scaleY)}
                />
                <Row label="Scale X" value={selected.scaleX.toFixed(3)} />
                <Row label="Scale Y" value={selected.scaleY.toFixed(3)} />
              </div>
            </div>

            {/* Source */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Source</p>
              <div className="bg-gray-800 rounded-md px-2 divide-y divide-gray-700/50">
                <Row label="Native W" value={selected.width} />
                <Row label="Native H" value={selected.height} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
