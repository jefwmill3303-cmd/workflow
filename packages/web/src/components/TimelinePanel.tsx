import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore, type TimelineClip, type TimelineTrack } from '../stores/editorStore.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const LABEL_W   = 88;  // px — fixed label column
const TRACK_H   = 52;  // px — height of each track lane (taller for waveforms)
const RULER_H   = 22;  // px
const HEADER_H  = 32;  // px
const MIN_CLIP_S = 0.05;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  if (m > 0) return `${m}:${s.toFixed(s < 10 && s % 1 !== 0 ? 1 : 0).padStart(s >= 10 ? 4 : 2, '0')}`;
  return `${s.toFixed(s >= 10 || s % 1 === 0 ? 0 : 1)}s`;
}

function getMajorInterval(zoom: number): number {
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600];
  return candidates.find((i) => i * zoom >= 60) ?? 600;
}

const TRACK_COLORS: Record<TimelineTrack['type'], { bg: string; border: string; dot: string }> = {
  video: { bg: 'bg-indigo-700',  border: 'border-indigo-500',  dot: 'bg-indigo-400'  },
  audio: { bg: 'bg-emerald-700', border: 'border-emerald-500', dot: 'bg-emerald-400' },
  text:  { bg: 'bg-purple-700',  border: 'border-purple-500',  dot: 'bg-purple-400'  },
};

// ── Drag state ────────────────────────────────────────────────────────────────
type DragState =
  | { kind: 'playhead'; startX: number; startTime: number }
  | { kind: 'clip';  startX: number; trackId: string; clipId: string; origStartTime: number }
  | { kind: 'trimL'; startX: number; trackId: string; clipId: string; origInPoint: number; origStartTime: number }
  | { kind: 'trimR'; startX: number; trackId: string; clipId: string; origOutPoint: number };

// ── Waveform + fade canvas inside a clip block ────────────────────────────────
function ClipWaveform({
  clip, width, height, waveformData, fadeIn, fadeOut, zoom,
}: {
  clip: TimelineClip;
  width: number;
  height: number;
  waveformData: Float32Array | undefined;
  fadeIn: number;
  fadeOut: number;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 1) return;
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // ── Waveform ────────────────────────────────────────────────────────────
    if (waveformData && waveformData.length > 0 && clip.duration > 0) {
      const numPoints = waveformData.length;
      const clipDur   = clip.outPoint - clip.inPoint;

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let x = 0; x < width; x++) {
        const sourceTime = clip.inPoint + (x / width) * clipDur;
        const idx        = Math.min(
          numPoints - 1,
          Math.floor((sourceTime / clip.duration) * numPoints),
        );
        const amp  = waveformData[idx] ?? 0;
        const barH = Math.max(1, amp * height * 0.9);
        ctx.fillRect(x, (height - barH) / 2, 1, barH);
      }
    }

    // ── Fade overlays ───────────────────────────────────────────────────────
    const clipDur    = clip.outPoint - clip.inPoint;
    const fadeInPx   = Math.min(fadeIn,  clipDur) * zoom;
    const fadeOutPx  = Math.min(fadeOut, clipDur) * zoom;

    if (fadeInPx > 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(fadeInPx, 0);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      // Diagonal ramp line
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(fadeInPx, 0);
      ctx.stroke();
      ctx.restore();
    }

    if (fadeOutPx > 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(width - fadeOutPx, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(width - fadeOutPx, 0);
      ctx.lineTo(width, height);
      ctx.stroke();
      ctx.restore();
    }
  }, [clip, width, height, waveformData, fadeIn, fadeOut, zoom]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TimelinePanel() {
  const tracks      = useEditorStore((s) => s.timelineTracks);
  const zoom        = useEditorStore((s) => s.timelineZoom);
  const activeTool  = useEditorStore((s) => s.activeTool);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const duration    = useEditorStore((s) => s.playback.duration);
  const waveformData = useEditorStore((s) => s.waveformData);
  const clipFades   = useEditorStore((s) => s.clipFades);

  const setCurrentTime  = useEditorStore((s) => s.setCurrentTime);
  const updateClip      = useEditorStore((s) => s.updateClip);
  const splitClip       = useEditorStore((s) => s.splitClip);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const setActiveClipId = useEditorStore((s) => s.setActiveClipId);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef     = useRef<DragState | null>(null);

  const maxEndTime = Math.max(
    duration, 30,
    ...tracks.flatMap((t) => t.clips.map((c) => c.startTime + (c.outPoint - c.inPoint))),
  );
  const contentW       = maxEndTime * zoom + 300;
  const majorInterval  = getMajorInterval(zoom);
  const minorInterval  = majorInterval / 5;

  // ── Playhead DOM sync (bypasses React re-render) ──────────────────────────
  useEffect(() => {
    let prev = -1;
    const unsub = useEditorStore.subscribe((s) => {
      const t = s.playback.currentTime;
      if (t === prev) return;
      prev = t;
      const el = playheadRef.current;
      if (el) el.style.left = `${LABEL_W + t * zoom}px`;
    });
    if (playheadRef.current) playheadRef.current.style.left = `${LABEL_W + currentTime * zoom}px`;
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // ── Global pointer events for drag ────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { timelineZoom: z, updateClip: uc } = useEditorStore.getState();
      const dx = e.clientX - drag.startX;
      const dt = dx / z;

      if (drag.kind === 'playhead') {
        useEditorStore.getState().setCurrentTime(Math.max(0, drag.startTime + dt));
        return;
      }
      if (drag.kind === 'clip') {
        uc(drag.trackId, drag.clipId, { startTime: Math.max(0, drag.origStartTime + dt) });
        return;
      }
      if (drag.kind === 'trimL') {
        const clip = useEditorStore.getState().timelineTracks
          .find((t) => t.id === drag.trackId)?.clips.find((c) => c.id === drag.clipId);
        if (!clip) return;
        const newInPoint = Math.max(0, Math.min(drag.origInPoint + dt, clip.outPoint - MIN_CLIP_S));
        uc(drag.trackId, drag.clipId, {
          inPoint: newInPoint,
          startTime: Math.max(0, drag.origStartTime + (newInPoint - drag.origInPoint)),
        });
        return;
      }
      if (drag.kind === 'trimR') {
        const clip = useEditorStore.getState().timelineTracks
          .find((t) => t.id === drag.trackId)?.clips.find((c) => c.id === drag.clipId);
        if (!clip) return;
        uc(drag.trackId, drag.clipId, {
          outPoint: Math.max(clip.inPoint + MIN_CLIP_S, Math.min(drag.origOutPoint + dt, clip.duration)),
        });
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, []);

  const handleRulerClick = useCallback((e: React.MouseEvent) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const rect = scroll.getBoundingClientRect();
    setCurrentTime(Math.max(0, (e.clientX - rect.left + scroll.scrollLeft - LABEL_W) / zoom));
  }, [zoom, setCurrentTime]);

  const handleLaneClick = useCallback((e: React.MouseEvent, trackId: string) => {
    if (activeTool !== 'split') return;
    e.stopPropagation();
    const scroll = scrollRef.current;
    if (!scroll) return;
    const rect = scroll.getBoundingClientRect();
    const clickTime = Math.max(0, (e.clientX - rect.left + scroll.scrollLeft - LABEL_W) / zoom);
    const track = useEditorStore.getState().timelineTracks.find((t) => t.id === trackId);
    const clip  = track?.clips.find((c) => {
      const end = c.startTime + (c.outPoint - c.inPoint);
      return clickTime > c.startTime && clickTime < end;
    });
    if (clip) splitClip(trackId, clip.id, clickTime);
  }, [activeTool, zoom, splitClip]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setTimelineZoom(Math.max(10, Math.min(600, zoom * (e.deltaY < 0 ? 1.25 : 0.8))));
  }, [zoom, setTimelineZoom]);

  const startClipDrag = useCallback((e: React.PointerEvent, trackId: string, clip: TimelineClip) => {
    e.stopPropagation();
    setActiveClipId(clip.id);
    dragRef.current = { kind: 'clip', startX: e.clientX, trackId, clipId: clip.id, origStartTime: clip.startTime };
  }, [setActiveClipId]);

  const startTrimL = useCallback((e: React.PointerEvent, trackId: string, clip: TimelineClip) => {
    e.stopPropagation();
    dragRef.current = { kind: 'trimL', startX: e.clientX, trackId, clipId: clip.id, origInPoint: clip.inPoint, origStartTime: clip.startTime };
  }, []);

  const startTrimR = useCallback((e: React.PointerEvent, trackId: string, clip: TimelineClip) => {
    e.stopPropagation();
    dragRef.current = { kind: 'trimR', startX: e.clientX, trackId, clipId: clip.id, origOutPoint: clip.outPoint };
  }, []);

  const startPlayheadDrag = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: 'playhead', startX: e.clientX, startTime: useEditorStore.getState().playback.currentTime };
  }, []);

  // ── Ruler ticks ───────────────────────────────────────────────────────────
  const totalSeconds = contentW / zoom;
  const ticks: Array<{ t: number; major: boolean }> = [];
  {
    let t = 0;
    while (t <= totalSeconds) {
      ticks.push({ t, major: Math.abs((t / majorInterval) % 1) < 0.001 || t === 0 });
      t = Math.round((t + minorInterval) * 1e6) / 1e6;
    }
  }

  return (
    <div
      className="flex-shrink-0 bg-gray-900 border-t border-gray-700 flex flex-col select-none"
      style={{ height: '14rem' }}
      onWheel={handleWheel}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 border-b border-gray-700 flex-shrink-0" style={{ height: HEADER_H }}>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Timeline</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          activeTool === 'split' ? 'bg-orange-700/80 text-orange-200' : 'bg-gray-800 text-gray-600'
        }`}>
          {activeTool === 'split' ? '✂ Split' : '↖ Select'}
        </span>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 font-mono tabular-nums">{fmtTime(currentTime)}</span>
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <button
          className="w-6 h-6 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-base font-bold leading-none transition-colors"
          onClick={() => setTimelineZoom(Math.max(10, zoom * 0.75))} title="Zoom out"
        >−</button>
        <span className="text-xs text-gray-600 font-mono w-14 text-center tabular-nums">{zoom.toFixed(0)} px/s</span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-base font-bold leading-none transition-colors"
          onClick={() => setTimelineZoom(Math.min(600, zoom * 1.33))} title="Zoom in"
        >+</button>
      </div>

      {/* ── Scrollable track area ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        style={{ cursor: activeTool === 'split' ? 'crosshair' : 'default' }}
      >
        <div className="relative" style={{ width: contentW + LABEL_W, minHeight: '100%' }}>
          {/* ── Ruler ──────────────────────────────────────────────────── */}
          <div
            className="flex border-b border-gray-700 cursor-pointer"
            style={{ height: RULER_H, paddingLeft: LABEL_W, position: 'sticky', top: 0, zIndex: 10, background: '#111827' }}
            onClick={handleRulerClick}
          >
            <div className="relative flex-1">
              {ticks.map(({ t, major }) => (
                <div key={t} className="absolute top-0 flex flex-col items-start" style={{ left: t * zoom }}>
                  <div className={major ? 'w-px bg-gray-500' : 'w-px bg-gray-700'} style={{ height: major ? RULER_H : RULER_H * 0.4 }} />
                  {major && t > 0 && (
                    <span className="absolute text-gray-500 font-mono whitespace-nowrap" style={{ fontSize: 9, top: 4, left: 3 }}>
                      {fmtTime(t)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Playhead ───────────────────────────────────────────────── */}
          <div ref={playheadRef} className="absolute z-20 pointer-events-none" style={{ top: 0, bottom: 0, left: LABEL_W + currentTime * zoom }}>
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: 0 }} />
            <div
              className="absolute w-3 h-3 bg-red-500 rotate-45 cursor-col-resize pointer-events-auto"
              style={{ top: 4, left: -5 }}
              onPointerDown={startPlayheadDrag}
            />
          </div>

          {/* ── Track lanes ────────────────────────────────────────────── */}
          {tracks.length === 0 ? (
            <div className="flex items-center justify-center text-xs text-gray-700" style={{ height: TRACK_H * 2 }}>
              Click a media file to add it to the canvas and timeline
            </div>
          ) : (
            tracks.map((track) => {
              const colors = TRACK_COLORS[track.type] ?? TRACK_COLORS.video;
              return (
                <div
                  key={track.id}
                  className="flex border-b border-gray-800"
                  style={{ height: TRACK_H }}
                  onClick={(e) => handleLaneClick(e, track.id)}
                >
                  {/* Label */}
                  <div
                    className="flex-shrink-0 flex items-center gap-1.5 px-2 border-r border-gray-700 bg-gray-900"
                    style={{ width: LABEL_W, position: 'sticky', left: 0, zIndex: 5 }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <span className="text-xs text-gray-400 truncate leading-none">{track.label}</span>
                  </div>

                  {/* Clips lane */}
                  <div className="flex-1 relative bg-gray-900/40">
                    {track.clips.map((clip) => {
                      const clipDur = clip.outPoint - clip.inPoint;
                      const left    = clip.startTime * zoom;
                      const width   = Math.max(clipDur * zoom, 4);
                      const fade    = clipFades[clip.id] ?? { clipId: clip.id, fadeIn: 0, fadeOut: 0 };

                      return (
                        <div
                          key={clip.id}
                          className={`absolute inset-y-1 flex rounded border overflow-hidden
                            cursor-grab active:cursor-grabbing ${colors.bg} ${colors.border}`}
                          style={{ left, width }}
                          onPointerDown={(e) => startClipDrag(e, track.id, clip)}
                        >
                          {/* Waveform canvas (for audio/video tracks) */}
                          {track.type !== 'text' && (
                            <ClipWaveform
                              clip={clip}
                              width={Math.max(1, width - 8)}
                              height={TRACK_H - 10}
                              waveformData={waveformData[clip.mediaFileId]}
                              fadeIn={fade.fadeIn}
                              fadeOut={fade.fadeOut}
                              zoom={zoom}
                            />
                          )}

                          {/* Trim-left handle */}
                          <div
                            className="flex-shrink-0 w-2 bg-black/40 hover:bg-black/60 cursor-col-resize flex items-center justify-center relative z-10"
                            onPointerDown={(e) => startTrimL(e, track.id, clip)}
                          >
                            <div className="w-px h-3 bg-white/40" />
                          </div>

                          {/* Label */}
                          <div className="flex-1 min-w-0 flex items-end px-1 pb-1 overflow-hidden relative z-10">
                            <span className="text-white/80 font-medium truncate" style={{ fontSize: 10 }}>
                              {clip.label}
                              {(fade.fadeIn > 0 || fade.fadeOut > 0) && (
                                <span className="ml-1 text-white/50" style={{ fontSize: 8 }}>
                                  {fade.fadeIn > 0 && `↑${fade.fadeIn.toFixed(1)}s`}
                                  {fade.fadeIn > 0 && fade.fadeOut > 0 && ' '}
                                  {fade.fadeOut > 0 && `↓${fade.fadeOut.toFixed(1)}s`}
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Trim-right handle */}
                          <div
                            className="flex-shrink-0 w-2 bg-black/40 hover:bg-black/60 cursor-col-resize flex items-center justify-center relative z-10"
                            onPointerDown={(e) => startTrimR(e, track.id, clip)}
                          >
                            <div className="w-px h-3 bg-white/40" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
