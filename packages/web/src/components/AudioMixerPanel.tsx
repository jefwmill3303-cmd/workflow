import { useEffect, useRef } from 'react';
import { useEditorStore, type TimelineTrack, type MixerTrack } from '../stores/editorStore.js';
import { getAnalyserLevel } from '../utils/audioEngine.js';

// ── VU Meter canvas ───────────────────────────────────────────────────────────
function VuMeter({ trackId }: { trackId: string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const peakRef    = useRef(0);
  const peakTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      const w = canvas.width;
      const h = canvas.height;
      const level = getAnalyserLevel(trackId) * 3.5; // boost sensitivity

      const now = performance.now();
      if (level > peakRef.current) {
        peakRef.current  = Math.min(1, level);
        peakTimeRef.current = now + 1200;
      } else if (now > peakTimeRef.current) {
        peakRef.current = Math.max(0, peakRef.current - 0.015);
      }

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // Segmented bar (green → amber → red)
      const segW = 3, gap = 1, totalSeg = Math.floor(w / (segW + gap));
      for (let i = 0; i < totalSeg; i++) {
        const ratio = i / totalSeg;
        const filled = ratio <= Math.min(1, level);
        if (filled) {
          ctx.fillStyle = ratio < 0.6 ? '#10b981' : ratio < 0.85 ? '#f59e0b' : '#ef4444';
        } else {
          ctx.fillStyle = ratio < 0.6 ? '#064e3b' : ratio < 0.85 ? '#78350f' : '#450a0a';
        }
        ctx.fillRect(i * (segW + gap), 0, segW, h);
      }

      // Peak hold indicator
      if (peakRef.current > 0) {
        const px = Math.floor(peakRef.current * totalSeg) * (segW + gap);
        const ratio = peakRef.current;
        ctx.fillStyle = ratio < 0.6 ? '#34d399' : ratio < 0.85 ? '#fbbf24' : '#f87171';
        ctx.fillRect(Math.min(px, w - segW), 0, segW, h);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackId]);

  return (
    <canvas
      ref={canvasRef}
      width={90}
      height={10}
      className="rounded overflow-hidden flex-shrink-0"
    />
  );
}

// ── Channel strip ─────────────────────────────────────────────────────────────
function ChannelStrip({ track, mixer }: { track: TimelineTrack; mixer: MixerTrack | undefined }) {
  const updateMixerTrack = useEditorStore((s) => s.updateMixerTrack);

  if (!mixer) return null;

  const vol = Math.round(mixer.volume * 100);

  return (
    <div className="flex items-center gap-2 px-3 h-10 border-b border-gray-700/50 last:border-0">
      {/* Mute button */}
      <button
        onClick={() => updateMixerTrack(track.id, { muted: !mixer.muted })}
        title={mixer.muted ? 'Unmute' : 'Mute'}
        className={`w-6 h-6 rounded text-xs font-bold flex-shrink-0 flex items-center justify-center border transition-colors ${
          mixer.muted
            ? 'bg-red-600 border-red-500 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-200 hover:bg-gray-700'
        }`}
      >
        M
      </button>

      {/* Track label */}
      <span
        className={`text-xs w-16 truncate flex-shrink-0 ${
          track.type === 'video' ? 'text-indigo-300' : 'text-emerald-300'
        }`}
        title={track.label}
      >
        {track.label}
      </span>

      {/* VU meter */}
      {mixer.muted ? (
        <div className="w-[90px] h-2.5 rounded bg-gray-800 flex-shrink-0 flex items-center justify-center">
          <span className="text-gray-600" style={{ fontSize: 8 }}>MUTED</span>
        </div>
      ) : (
        <VuMeter trackId={track.id} />
      )}

      {/* Volume % label */}
      <span className="text-xs font-mono text-gray-500 w-9 text-right flex-shrink-0">
        {vol}%
      </span>

      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={2}
        step={0.01}
        value={mixer.volume}
        onChange={(e) => updateMixerTrack(track.id, { volume: parseFloat(e.target.value) })}
        className="flex-1 h-1 accent-emerald-500 cursor-pointer"
        title={`Volume: ${vol}%`}
      />

      {/* 100% tick mark label */}
      <span className="text-xs text-gray-700 flex-shrink-0">200%</span>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function AudioMixerPanel() {
  const tracks      = useEditorStore((s) =>
    s.timelineTracks.filter((t) => t.type === 'video' || t.type === 'audio'),
  );
  const mixerTracks = useEditorStore((s) => s.mixerTracks);

  if (tracks.length === 0) return null;

  return (
    <div className="flex-shrink-0 bg-gray-900 border-t border-gray-700">
      {/* Header */}
      <div
        className="flex items-center px-3 border-b border-gray-700"
        style={{ height: 24 }}
      >
        <svg className="w-3 h-3 text-emerald-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Audio Mixer
        </span>
      </div>

      {/* Channel strips */}
      <div>
        {tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            track={track}
            mixer={mixerTracks[track.id]}
          />
        ))}
      </div>
    </div>
  );
}
