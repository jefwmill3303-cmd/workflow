import {
  useEditorStore,
  type TextObject,
  type TextAnimation,
  type VideoOverlay,
  type OverlayAnimation,
  type ClipFade,
} from '../stores/editorStore.js';

// ── Font list ─────────────────────────────────────────────────────────────────
const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New',
  'Impact', 'Verdana', 'Trebuchet MS', 'Comic Sans MS',
  'Bebas Neue', 'Montserrat', 'Oswald', 'Raleway', 'Roboto', 'Open Sans',
];

const TEXT_ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: 'none',       label: 'None' },
  { value: 'fade-in',    label: 'Fade In' },
  { value: 'slide-up',   label: 'Slide Up' },
  { value: 'pop',        label: 'Pop / Scale' },
  { value: 'typewriter', label: 'Typewriter' },
];

const OVERLAY_ANIMATIONS: { value: OverlayAnimation; label: string }[] = [
  { value: 'none',         label: 'None' },
  { value: 'fade',         label: 'Fade' },
  { value: 'slide-left',   label: 'Slide from Left' },
  { value: 'slide-right',  label: 'Slide from Right' },
  { value: 'slide-top',    label: 'Slide from Top' },
  { value: 'slide-bottom', label: 'Slide from Bottom' },
  { value: 'scale-up',     label: 'Scale Up' },
];

// ── Small UI primitives ───────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-1">
      {children}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-200 font-mono">{value}</span>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-gray-400 flex-shrink-0 w-20">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label
      className="relative w-7 h-7 rounded cursor-pointer border border-gray-600 overflow-hidden flex-shrink-0"
      title={value}
    >
      <span className="absolute inset-0 rounded" style={{ background: value }} />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </label>
  );
}

function NumInput({
  value, onChange, min = 0, max, step = 1, className = '',
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`bg-gray-800 text-gray-200 text-xs rounded px-1.5 py-1 w-16 text-right border border-gray-700 focus:outline-none focus:border-indigo-500 ${className}`}
    />
  );
}

function ToggleBtn({
  active, onClick, title, children,
}: {
  active: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 rounded text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center border ${
        active
          ? 'bg-indigo-600 border-indigo-500 text-white'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function PillSwitch({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-8 h-4 rounded-full transition-colors ${active ? 'bg-indigo-600' : 'bg-gray-700'}`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function SliderRow({
  label, value, onChange, min = 0, max = 1, step = 0.01,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-indigo-500"
        />
        <span className="text-xs text-gray-400 font-mono w-8 text-right">
          {max === 1 ? `${Math.round(value * 100)}%` : String(Math.round(value))}
        </span>
      </div>
    </FieldRow>
  );
}

// ── Text properties panel ─────────────────────────────────────────────────────
function TextProperties({
  obj, onUpdate,
}: {
  obj: TextObject;
  onUpdate: (u: Partial<TextObject>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Text content */}
      <div>
        <SectionTitle>Content</SectionTitle>
        <textarea
          value={obj.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 p-2 resize-none focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Font */}
      <div>
        <SectionTitle>Font</SectionTitle>
        <div className="space-y-1.5">
          <select
            value={obj.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-indigo-500"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <NumInput
              value={obj.fontSize}
              onChange={(v) => onUpdate({ fontSize: Math.max(8, v) })}
              min={8} max={500}
              className="flex-1 w-full"
            />
            <ToggleBtn
              active={obj.fontWeight === 'bold'}
              onClick={() => onUpdate({ fontWeight: obj.fontWeight === 'bold' ? 'normal' : 'bold' })}
              title="Bold"
            >
              <span style={{ fontWeight: 'bold' }}>B</span>
            </ToggleBtn>
            <ToggleBtn
              active={obj.fontStyle === 'italic'}
              onClick={() => onUpdate({ fontStyle: obj.fontStyle === 'italic' ? 'normal' : 'italic' })}
              title="Italic"
            >
              <span style={{ fontStyle: 'italic' }}>I</span>
            </ToggleBtn>
          </div>

          {/* Alignment */}
          <div className="flex gap-1">
            {([
              { val: 'left',   icon: 'M4 6h16M4 10h10M4 14h12M4 18h8' },
              { val: 'center', icon: 'M4 6h16M7 10h10M5 14h14M8 18h8' },
              { val: 'right',  icon: 'M4 6h16M10 10h10M8 14h12M12 18h8' },
            ] as const).map(({ val, icon }) => (
              <ToggleBtn
                key={val}
                active={obj.textAlign === val}
                onClick={() => onUpdate({ textAlign: val })}
                title={val.charAt(0).toUpperCase() + val.slice(1)}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d={icon} />
                </svg>
              </ToggleBtn>
            ))}
          </div>
        </div>
      </div>

      {/* Fill */}
      <div>
        <SectionTitle>Fill</SectionTitle>
        <FieldRow label="Color">
          <ColorSwatch value={obj.fill} onChange={(v) => onUpdate({ fill: v })} />
        </FieldRow>
      </div>

      {/* Stroke */}
      <div>
        <SectionTitle>Outline</SectionTitle>
        <FieldRow label="Color">
          <ColorSwatch value={obj.stroke} onChange={(v) => onUpdate({ stroke: v })} />
        </FieldRow>
        <FieldRow label="Width">
          <NumInput value={obj.strokeWidth} onChange={(v) => onUpdate({ strokeWidth: Math.max(0, v) })} min={0} max={30} />
        </FieldRow>
      </div>

      {/* Shadow */}
      <div>
        <SectionTitle>
          <span className="flex items-center justify-between">
            Shadow
            <PillSwitch active={obj.shadow} onClick={() => onUpdate({ shadow: !obj.shadow })} />
          </span>
        </SectionTitle>
        {obj.shadow && (
          <div className="space-y-0.5">
            <FieldRow label="Color">
              <ColorSwatch value={obj.shadowColor} onChange={(v) => onUpdate({ shadowColor: v })} />
            </FieldRow>
            <FieldRow label="X Offset">
              <NumInput value={obj.shadowOffsetX} onChange={(v) => onUpdate({ shadowOffsetX: v })} min={-100} max={100} />
            </FieldRow>
            <FieldRow label="Y Offset">
              <NumInput value={obj.shadowOffsetY} onChange={(v) => onUpdate({ shadowOffsetY: v })} min={-100} max={100} />
            </FieldRow>
            <FieldRow label="Blur">
              <NumInput value={obj.shadowBlur} onChange={(v) => onUpdate({ shadowBlur: Math.max(0, v) })} min={0} max={100} />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Background */}
      <div>
        <SectionTitle>Background</SectionTitle>
        <FieldRow label="Color">
          <ColorSwatch value={obj.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
        </FieldRow>
        <SliderRow label="Opacity" value={obj.backgroundOpacity} onChange={(v) => onUpdate({ backgroundOpacity: v })} />
      </div>

      {/* Animation */}
      <div>
        <SectionTitle>Animation</SectionTitle>
        <div className="grid grid-cols-1 gap-1">
          {TEXT_ANIMATIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ animation: value })}
              className={`text-left text-xs px-2.5 py-1.5 rounded border transition-colors ${
                obj.animation === value
                  ? 'bg-indigo-700 border-indigo-500 text-indigo-100'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Video overlay properties panel ────────────────────────────────────────────
function VideoOverlayProperties({
  mediaId,
}: {
  mediaId: string;
}) {
  const canvasObjects    = useEditorStore((s) => s.canvasObjects);
  const overlay          = useEditorStore((s) => s.videoOverlays[mediaId]);
  const updateOverlay    = useEditorStore((s) => s.updateVideoOverlay);
  const obj              = canvasObjects.find((o) => o.id === mediaId);

  if (!overlay || !obj) return null;

  const upd = (updates: Partial<VideoOverlay>) => updateOverlay(mediaId, updates);
  const updCK = (updates: Partial<VideoOverlay['chromaKey']>) =>
    upd({ chromaKey: { ...overlay.chromaKey, ...updates } });
  const updBorder = (updates: Partial<VideoOverlay['border']>) =>
    upd({ border: { ...overlay.border, ...updates } });
  const updCrop = (updates: Partial<VideoOverlay['crop']>) =>
    upd({ crop: { ...overlay.crop, ...updates } });

  return (
    <div className="space-y-4">
      {/* Type badge + filename */}
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-900/60 text-indigo-300">
          VIDEO
        </span>
        <span className="text-xs text-gray-300 font-medium truncate" title={obj.filename}>
          {obj.filename}
        </span>
      </div>

      {/* Transform */}
      <div>
        <SectionTitle>Transform</SectionTitle>
        <div className="bg-gray-800 rounded-md px-2 divide-y divide-gray-700/50">
          <Row label="X"       value={Math.round(obj.x)} />
          <Row label="Y"       value={Math.round(obj.y)} />
          <Row label="W"       value={Math.round(obj.width  * obj.scaleX)} />
          <Row label="H"       value={Math.round(obj.height * obj.scaleY)} />
        </div>
      </div>

      {/* Opacity */}
      <div>
        <SectionTitle>Opacity</SectionTitle>
        <SliderRow label="Opacity" value={overlay.opacity} onChange={(v) => upd({ opacity: v })} />
      </div>

      {/* Chroma Key */}
      <div>
        <SectionTitle>
          <span className="flex items-center justify-between">
            Chroma Key
            <PillSwitch
              active={overlay.chromaKey.enabled}
              onClick={() => updCK({ enabled: !overlay.chromaKey.enabled })}
            />
          </span>
        </SectionTitle>
        {overlay.chromaKey.enabled && (
          <div className="space-y-0.5">
            <FieldRow label="Key Color">
              <ColorSwatch
                value={overlay.chromaKey.color}
                onChange={(v) => updCK({ color: v })}
              />
            </FieldRow>
            <SliderRow
              label="Similarity"
              value={overlay.chromaKey.similarity}
              onChange={(v) => updCK({ similarity: v })}
            />
            <SliderRow
              label="Smoothness"
              value={overlay.chromaKey.smoothness}
              onChange={(v) => updCK({ smoothness: v })}
            />
            <SliderRow
              label="Spill"
              value={overlay.chromaKey.spillSuppress}
              onChange={(v) => updCK({ spillSuppress: v })}
            />
          </div>
        )}
      </div>

      {/* Border */}
      <div>
        <SectionTitle>
          <span className="flex items-center justify-between">
            Border
            <PillSwitch
              active={overlay.border.enabled}
              onClick={() => updBorder({ enabled: !overlay.border.enabled })}
            />
          </span>
        </SectionTitle>
        {overlay.border.enabled && (
          <div className="space-y-0.5">
            <FieldRow label="Color">
              <ColorSwatch value={overlay.border.color} onChange={(v) => updBorder({ color: v })} />
            </FieldRow>
            <FieldRow label="Width">
              <NumInput value={overlay.border.width} onChange={(v) => updBorder({ width: Math.max(0, v) })} min={0} max={40} />
            </FieldRow>
            <FieldRow label="Radius">
              <NumInput value={overlay.border.radius} onChange={(v) => updBorder({ radius: Math.max(0, v) })} min={0} max={500} />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Drop Shadow */}
      <div>
        <SectionTitle>
          <span className="flex items-center justify-between">
            Drop Shadow
            <PillSwitch
              active={overlay.dropShadow}
              onClick={() => upd({ dropShadow: !overlay.dropShadow })}
            />
          </span>
        </SectionTitle>
      </div>

      {/* Crop */}
      <div>
        <SectionTitle>Crop (px)</SectionTitle>
        <div className="space-y-0.5">
          <FieldRow label="Top">
            <NumInput value={overlay.crop.top}    onChange={(v) => updCrop({ top:    Math.max(0, v) })} min={0} max={2000} />
          </FieldRow>
          <FieldRow label="Bottom">
            <NumInput value={overlay.crop.bottom} onChange={(v) => updCrop({ bottom: Math.max(0, v) })} min={0} max={2000} />
          </FieldRow>
          <FieldRow label="Left">
            <NumInput value={overlay.crop.left}   onChange={(v) => updCrop({ left:   Math.max(0, v) })} min={0} max={2000} />
          </FieldRow>
          <FieldRow label="Right">
            <NumInput value={overlay.crop.right}  onChange={(v) => updCrop({ right:  Math.max(0, v) })} min={0} max={2000} />
          </FieldRow>
        </div>
      </div>

      {/* Entry animation */}
      <div>
        <SectionTitle>Entry Animation</SectionTitle>
        <div className="grid grid-cols-1 gap-1">
          {OVERLAY_ANIMATIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => upd({ entryAnimation: value })}
              className={`text-left text-xs px-2.5 py-1.5 rounded border transition-colors ${
                overlay.entryAnimation === value
                  ? 'bg-indigo-700 border-indigo-500 text-indigo-100'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Exit animation */}
      <div>
        <SectionTitle>Exit Animation</SectionTitle>
        <div className="grid grid-cols-1 gap-1">
          {OVERLAY_ANIMATIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => upd({ exitAnimation: value })}
              className={`text-left text-xs px-2.5 py-1.5 rounded border transition-colors ${
                overlay.exitAnimation === value
                  ? 'bg-emerald-700 border-emerald-500 text-emerald-100'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Clip fade controls (shown for any selected clip) ──────────────────────────
function ClipFadeSection({ clipId }: { clipId: string }) {
  const tracks         = useEditorStore((s) => s.timelineTracks);
  const fade           = useEditorStore((s) => s.clipFades[clipId]);
  const updateClipFade = useEditorStore((s) => s.updateClipFade);

  // Find clip duration so we can cap the sliders
  let clipDur = 60;
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) { clipDur = clip.outPoint - clip.inPoint; break; }
  }

  if (!fade) return null;

  const upd = (u: Partial<ClipFade>) => updateClipFade(clipId, u);

  return (
    <div>
      <SectionTitle>Clip Fades</SectionTitle>
      <div className="space-y-1">
        <SliderRow
          label="Fade In"
          value={fade.fadeIn}
          onChange={(v) => upd({ fadeIn: Math.round(v * 10) / 10 })}
          min={0}
          max={Math.max(1, clipDur)}
          step={0.1}
        />
        <SliderRow
          label="Fade Out"
          value={fade.fadeOut}
          onChange={(v) => upd({ fadeOut: Math.round(v * 10) / 10 })}
          min={0}
          max={Math.max(1, clipDur)}
          step={0.1}
        />
      </div>
    </div>
  );
}

// ── Audio clip properties (for audio-only clips with no canvas object) ─────────
function AudioClipProperties({ clipId }: { clipId: string }) {
  const tracks = useEditorStore((s) => s.timelineTracks);
  let label = 'Audio Clip';
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) { label = clip.label; break; }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-900/60 text-emerald-300">
          AUDIO
        </span>
        <span className="text-xs text-gray-300 font-medium truncate" title={label}>{label}</span>
      </div>
      <ClipFadeSection clipId={clipId} />
    </div>
  );
}

// ── Non-video media properties (audio / image) ────────────────────────────────
function MediaProperties({ obj }: { obj: ReturnType<typeof useEditorStore.getState>['canvasObjects'][number] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            obj.type === 'IMAGE'
              ? 'bg-yellow-900/60 text-yellow-300'
              : 'bg-emerald-900/60 text-emerald-300'
          }`}
        >
          {obj.type}
        </span>
        <span className="text-xs text-gray-300 font-medium truncate" title={obj.filename}>
          {obj.filename}
        </span>
      </div>

      <div>
        <SectionTitle>Transform</SectionTitle>
        <div className="bg-gray-800 rounded-md px-2 divide-y divide-gray-700/50">
          <Row label="X"       value={Math.round(obj.x)} />
          <Row label="Y"       value={Math.round(obj.y)} />
          <Row label="W"       value={Math.round(obj.width  * obj.scaleX)} />
          <Row label="H"       value={Math.round(obj.height * obj.scaleY)} />
          <Row label="Scale X" value={obj.scaleX.toFixed(3)} />
          <Row label="Scale Y" value={obj.scaleY.toFixed(3)} />
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function PropertiesPanel() {
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const activeClipId     = useEditorStore((s) => s.activeClipId);
  const canvasObjects    = useEditorStore((s) => s.canvasObjects);
  const textObjects      = useEditorStore((s) => s.textObjects);
  const timelineTracks   = useEditorStore((s) => s.timelineTracks);
  const updateTextObject = useEditorStore((s) => s.updateTextObject);

  const selectedText  = selectedObjectId ? textObjects[selectedObjectId] : undefined;
  const selectedMedia = canvasObjects.find((o) => o.id === selectedObjectId);

  // Find the timeline clip for the selected canvas object (for fades)
  const clipIdForSelected = (() => {
    if (!selectedObjectId) return null;
    for (const track of timelineTracks) {
      const clip = track.clips.find((c) => c.mediaFileId === selectedObjectId);
      if (clip) return clip.id;
    }
    return null;
  })();

  // Is activeClipId for an audio-only clip (no canvas object)?
  const isAudioOnlyClip = activeClipId && !selectedObjectId && (() => {
    for (const track of timelineTracks) {
      if (track.type !== 'audio') continue;
      if (track.clips.some((c) => c.id === activeClipId)) return true;
    }
    return false;
  })();

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      <div className="px-3 py-2.5 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Inspector
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selectedText ? (
          <TextProperties
            obj={selectedText}
            onUpdate={(u) => updateTextObject(selectedText.id, u)}
          />
        ) : selectedMedia?.type === 'VIDEO' ? (
          <div className="space-y-4">
            <VideoOverlayProperties mediaId={selectedMedia.id} />
            {clipIdForSelected && (
              <div className="border-t border-gray-700 pt-4">
                <ClipFadeSection clipId={clipIdForSelected} />
              </div>
            )}
          </div>
        ) : selectedMedia ? (
          <div className="space-y-4">
            <MediaProperties obj={selectedMedia} />
            {clipIdForSelected && (
              <div className="border-t border-gray-700 pt-4">
                <ClipFadeSection clipId={clipIdForSelected} />
              </div>
            )}
          </div>
        ) : isAudioOnlyClip && activeClipId ? (
          <AudioClipProperties clipId={activeClipId} />
        ) : (
          <div className="mt-12 text-center">
            <svg className="w-8 h-8 text-gray-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
            <p className="text-xs text-gray-600">Click an object on canvas or a clip on the timeline to inspect</p>
          </div>
        )}
      </div>
    </div>
  );
}
