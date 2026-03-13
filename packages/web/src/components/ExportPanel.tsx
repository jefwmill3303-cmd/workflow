import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore.js';

// ── Types ──────────────────────────────────────────────────────────────────────
type Platform = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'custom';
type Quality = 'low' | 'medium' | 'high' | 'max';

interface PlatformPreset {
  id: Platform;
  label: string;
  icon: string;
  width: number;
  height: number;
  codec: string;
  fps: number | number[];
  maxDuration: number; // seconds
  description: string;
}

interface ExportRecord {
  id: string;
  platform: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  progress: number;
  output_url?: string;
  error?: string;
  created_at: string;
}

const PLATFORMS: PlatformPreset[] = [
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    width: 1080,
    height: 1920,
    codec: 'H.264',
    fps: 30,
    maxDuration: 600,
    description: '9:16 vertical · 30fps · up to 10 min',
  },
  {
    id: 'instagram_reels',
    label: 'Instagram Reels',
    icon: '📷',
    width: 1080,
    height: 1920,
    codec: 'H.264',
    fps: 30,
    maxDuration: 90,
    description: '9:16 vertical · 30fps · up to 90 sec',
  },
  {
    id: 'youtube_shorts',
    label: 'YouTube Shorts',
    icon: '▶️',
    width: 1080,
    height: 1920,
    codec: 'H.264',
    fps: [30, 60],
    maxDuration: 60,
    description: '9:16 vertical · 30/60fps · up to 60 sec',
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: '⚙️',
    width: 1920,
    height: 1080,
    codec: 'H.264',
    fps: 30,
    maxDuration: Infinity,
    description: 'Set resolution, FPS & bitrate manually',
  },
];

const QUALITY_PRESETS: Record<Quality, { label: string; bitrate: number }> = {
  low:    { label: 'Low',    bitrate: 2000 },
  medium: { label: 'Medium', bitrate: 4000 },
  high:   { label: 'High',   bitrate: 8000 },
  max:    { label: 'Max',    bitrate: 16000 },
};

function estimateFileSizeMB(durationSec: number, bitrateKbps: number): number {
  // size (MB) = (bitrate kbps × duration s) / 8 / 1024
  return (bitrateKbps * durationSec) / 8 / 1024;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fpsOptions(platform: PlatformPreset): number[] {
  return Array.isArray(platform.fps) ? platform.fps : [platform.fps];
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ExportRecord['status'] }) {
  const map = {
    queued:     'bg-yellow-900/60 text-yellow-300',
    processing: 'bg-blue-900/60 text-blue-300',
    complete:   'bg-emerald-900/60 text-emerald-300',
    failed:     'bg-red-900/60 text-red-300',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

// ── Single export row with progress bar ───────────────────────────────────────
function ExportRow({ exportId, onDone }: { exportId: string; onDone?: () => void }) {
  const [record, setRecord] = useState<ExportRecord | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/exports/${exportId}`);
        if (!res.ok) return;
        const json = await res.json() as { data: ExportRecord };
        if (!active) return;
        setRecord(json.data);
        if (json.data.status === 'complete' || json.data.status === 'failed') {
          onDone?.();
          return; // stop polling
        }
        setTimeout(() => void poll(), 2000);
      } catch { /* ignore */ }
    };
    void poll();
    return () => { active = false; };
  }, [exportId, onDone]);

  if (!record) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  const preset = PLATFORMS.find((p) => p.id === record.platform);
  const label = preset?.label ?? record.platform;
  const eta =
    record.status === 'processing' && record.progress > 0
      ? formatDuration(((100 - record.progress) / record.progress) * 30)
      : null;

  return (
    <div className="rounded-md bg-gray-800 border border-gray-700 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-200">{label}</span>
        <StatusBadge status={record.status} />
      </div>

      {(record.status === 'queued' || record.status === 'processing') && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{record.progress}%</span>
            {eta && <span>ETA ~{eta}</span>}
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500 rounded-full"
              style={{ width: `${record.progress}%` }}
            />
          </div>
        </div>
      )}

      {record.status === 'complete' && record.output_url && (
        <a
          href={record.output_url}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
          target="_blank"
          rel="noreferrer"
        >
          Download
        </a>
      )}

      {record.status === 'failed' && (
        <p className="text-xs text-red-400">{record.error ?? 'Export failed'}</p>
      )}
    </div>
  );
}

// ── Main ExportPanel ──────────────────────────────────────────────────────────
interface ExportPanelProps {
  onClose: () => void;
}

export function ExportPanel({ onClose }: ExportPanelProps) {
  const project        = useEditorStore((s) => s.project);
  const timelineTracks = useEditorStore((s) => s.timelineTracks);
  const mixerTracks    = useEditorStore((s) => s.mixerTracks);
  const clipFades      = useEditorStore((s) => s.clipFades);
  const textObjects    = useEditorStore((s) => s.textObjects);
  const videoOverlays  = useEditorStore((s) => s.videoOverlays);

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('tiktok');
  const [quality, setQuality]           = useState<Quality>('high');
  const [customWidth, setCustomWidth]   = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [customFps, setCustomFps]       = useState(30);
  const [customBitrate, setCustomBitrate] = useState(8000);
  const [activeExportIds, setActiveExportIds] = useState<string[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const preset = PLATFORMS.find((p) => p.id === selectedPlatform)!;
  const fps = selectedPlatform === 'custom'
    ? customFps
    : (Array.isArray(preset.fps) ? preset.fps[0] : preset.fps);
  const bitrate = selectedPlatform === 'custom'
    ? customBitrate
    : QUALITY_PRESETS[quality].bitrate;

  // Total timeline duration in seconds
  const totalDuration = timelineTracks.reduce((max, track) => {
    const trackEnd = track.clips.reduce((m, c) => Math.max(m, c.startTime + (c.outPoint - c.inPoint)), 0);
    return Math.max(max, trackEnd);
  }, 0);

  const estimatedMB = estimateFileSizeMB(totalDuration, bitrate);

  const buildProjectState = useCallback(() => ({
    timelineTracks,
    mixerTracks,
    clipFades,
    textObjects,
    videoOverlays,
    duration: totalDuration,
  }), [timelineTracks, mixerTracks, clipFades, textObjects, videoOverlays, totalDuration]);

  const buildSettings = useCallback((platform: Platform) => {
    const p = PLATFORMS.find((pr) => pr.id === platform)!;
    return {
      width:   platform === 'custom' ? customWidth  : p.width,
      height:  platform === 'custom' ? customHeight : p.height,
      fps:     platform === 'custom' ? customFps    : (Array.isArray(p.fps) ? p.fps[0] : p.fps),
      bitrate: platform === 'custom' ? customBitrate : QUALITY_PRESETS[quality].bitrate,
      codec:   p.codec,
      quality,
    };
  }, [customWidth, customHeight, customFps, customBitrate, quality]);

  const startExport = useCallback(async (platforms: Platform[]) => {
    if (!project?.id) {
      setError('No project loaded');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ids: string[] = [];
      for (const platform of platforms) {
        const res = await fetch('/api/exports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId:    project.id,
            platform,
            settings:     buildSettings(platform),
            projectState: buildProjectState(),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: ExportRecord };
        ids.push(json.data.id);
      }
      setActiveExportIds((prev) => [...prev, ...ids]);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }, [project, buildSettings, buildProjectState]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[540px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-100">Export Video</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Platform cards */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Platform Preset</p>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    selectedPlatform === p.id
                      ? 'border-indigo-500 bg-indigo-950/50'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{p.icon}</span>
                    <span className="text-sm font-medium text-gray-100">{p.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom options */}
          {selectedPlatform === 'custom' && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Custom Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Width</span>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Height</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">FPS</span>
                  <input
                    type="number"
                    value={customFps}
                    onChange={(e) => setCustomFps(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Bitrate (kbps)</span>
                  <input
                    type="number"
                    value={customBitrate}
                    onChange={(e) => setCustomBitrate(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Quality + FPS (non-custom) */}
          {selectedPlatform !== 'custom' && (
            <div className="flex gap-3">
              <label className="flex-1 space-y-1">
                <span className="text-xs text-gray-400">Quality</span>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as Quality)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100"
                >
                  {(Object.entries(QUALITY_PRESETS) as [Quality, { label: string; bitrate: number }][]).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} — {v.bitrate} kbps
                    </option>
                  ))}
                </select>
              </label>

              {Array.isArray(preset.fps) && preset.fps.length > 1 && (
                <label className="w-28 space-y-1">
                  <span className="text-xs text-gray-400">FPS</span>
                  <select
                    value={fps}
                    onChange={(e) => { /* read-only for non-custom; just for display */ }}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100"
                  >
                    {fpsOptions(preset).map((f) => (
                      <option key={f} value={f}>{f} fps</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* File size estimate */}
          <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-400 space-y-0.5">
              <p>
                {selectedPlatform !== 'custom' ? `${preset.width}×${preset.height}` : `${customWidth}×${customHeight}`}
                {' · '}{fps} fps{' · '}{bitrate} kbps
              </p>
              <p>Project duration: {formatDuration(totalDuration)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Est. file size</p>
              <p className="text-sm font-semibold text-gray-100">
                {estimatedMB < 1 ? `${(estimatedMB * 1024).toFixed(0)} KB` : `${estimatedMB.toFixed(1)} MB`}
              </p>
            </div>
          </div>

          {/* Active exports */}
          {activeExportIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Exports</p>
              {activeExportIds.map((id) => (
                <ExportRow key={id} exportId={id} />
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700 flex-shrink-0 gap-2">
          {/* Batch export */}
          <button
            onClick={() => void startExport(['tiktok', 'instagram_reels', 'youtube_shorts'])}
            disabled={submitting}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-100 text-xs font-medium rounded-md transition-colors"
            title="Queue all 3 platform presets at once"
          >
            {submitting ? 'Queuing…' : 'Batch Export (All Platforms)'}
          </button>

          {/* Single export */}
          <button
            onClick={() => void startExport([selectedPlatform])}
            disabled={submitting}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors"
          >
            {submitting ? 'Starting…' : `Export for ${preset.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
