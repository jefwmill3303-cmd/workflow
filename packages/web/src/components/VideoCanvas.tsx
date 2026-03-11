import { useCallback, useEffect, useRef } from 'react';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { useEditorStore } from '../stores/editorStore.js';

const LOGICAL_W = 1080;
const LOGICAL_H = 1920;

type VideoEntry = { videoEl: HTMLVideoElement; fabricImg: FabricImage };

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoCanvas() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const videoMapRef = useRef<Map<string, VideoEntry>>(new Map());
  const rafRef = useRef<number>(0);
  const activeMediaIdRef = useRef<string | null>(null);

  const mediaToLoad = useEditorStore((s) => s.mediaToLoad);
  const playback = useEditorStore((s) => s.playback);
  const clearMediaToLoad = useEditorStore((s) => s.clearMediaToLoad);
  const addCanvasObject = useEditorStore((s) => s.addCanvasObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setDuration = useEditorStore((s) => s.setDuration);

  // ── Init Fabric canvas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const scale = Math.min(rect.width / LOGICAL_W, rect.height / LOGICAL_H);

    const fc = new FabricCanvas(canvasElRef.current, {
      width: LOGICAL_W * scale,
      height: LOGICAL_H * scale,
      backgroundColor: '#111111',
    });
    fc.setZoom(scale);
    fabricRef.current = fc;

    fc.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      const id = (obj as { data?: { objectId?: string } } | undefined)?.data?.objectId;
      if (id) setSelectedObjectId(id);
    });
    fc.on('selection:cleared', () => setSelectedObjectId(null));

    const ro = new ResizeObserver(() => {
      if (!fabricRef.current) return;
      const r = container.getBoundingClientRect();
      const s = Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H);
      fabricRef.current.setDimensions({ width: LOGICAL_W * s, height: LOGICAL_H * s });
      fabricRef.current.setZoom(s);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      videoMapRef.current.forEach(({ videoEl }) => {
        videoEl.pause();
        videoEl.src = '';
      });
      videoMapRef.current.clear();
      void fc.dispose();
      fabricRef.current = null;
    };
  }, [setSelectedObjectId]);

  // ── Load media onto canvas ────────────────────────────────────────────────
  useEffect(() => {
    if (!mediaToLoad || !fabricRef.current) return;
    const fc = fabricRef.current;
    const file = mediaToLoad;
    clearMediaToLoad();

    if (file.type === 'VIDEO') {
      const existing = videoMapRef.current.get(file.id);
      if (existing) {
        // Already loaded — just make it the active video
        activeMediaIdRef.current = file.id;
        setDuration(existing.videoEl.duration);
        fc.setActiveObject(existing.fabricImg);
        fc.requestRenderAll();
        return;
      }

      const videoEl = document.createElement('video');
      videoEl.src = file.url;
      videoEl.crossOrigin = 'anonymous';
      videoEl.loop = false;
      videoEl.playsInline = true;
      videoEl.muted = false;
      videoEl.preload = 'metadata';
      videoEl.load();

      videoEl.addEventListener(
        'loadedmetadata',
        () => {
          const { videoWidth, videoHeight, duration } = videoEl;
          const fabricImg = new FabricImage(videoEl, {
            originX: 'center',
            originY: 'center',
            left: LOGICAL_W / 2,
            top: LOGICAL_H / 2,
          });
          const scaleX = LOGICAL_W / (videoWidth || LOGICAL_W);
          const scaleY = scaleX;
          fabricImg.set({ scaleX, scaleY });
          (fabricImg as FabricImage & { data: Record<string, unknown> }).data = {
            mediaId: file.id,
            objectId: file.id,
          };

          fc.add(fabricImg);
          fc.requestRenderAll();

          const entry: VideoEntry = { videoEl, fabricImg };
          videoMapRef.current.set(file.id, entry);
          activeMediaIdRef.current = file.id;

          useEditorStore.getState().setDuration(duration);
          useEditorStore.getState().setCurrentTime(0);
          useEditorStore.getState().addCanvasObject({
            id: file.id,
            mediaId: file.id,
            type: 'VIDEO',
            filename: file.filename,
            x: LOGICAL_W / 2,
            y: LOGICAL_H / 2,
            width: videoWidth,
            height: videoHeight,
            scaleX,
            scaleY,
          });

          videoEl.addEventListener('ended', () => {
            useEditorStore.getState().setPlaying(false);
            useEditorStore.getState().setCurrentTime(videoEl.duration);
          });
        },
        { once: true },
      );
    } else if (file.type === 'IMAGE') {
      FabricImage.fromURL(file.url, { crossOrigin: 'anonymous' })
        .then((img) => {
          img.set({
            originX: 'center',
            originY: 'center',
            left: LOGICAL_W / 2,
            top: LOGICAL_H / 2,
          });
          const scaleX = LOGICAL_W / (img.width || LOGICAL_W);
          img.set({ scaleX, scaleY: scaleX });
          (img as FabricImage & { data: Record<string, unknown> }).data = {
            mediaId: file.id,
            objectId: file.id,
          };
          fc.add(img);
          fc.requestRenderAll();
          addCanvasObject({
            id: file.id,
            mediaId: file.id,
            type: 'IMAGE',
            filename: file.filename,
            x: LOGICAL_W / 2,
            y: LOGICAL_H / 2,
            width: img.width ?? 0,
            height: img.height ?? 0,
            scaleX,
            scaleY: scaleX,
          });
        })
        .catch(console.error);
    }
  }, [mediaToLoad, clearMediaToLoad, addCanvasObject, setDuration]);

  // ── Play / pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mediaId = activeMediaIdRef.current;
    const entry = mediaId ? videoMapRef.current.get(mediaId) : undefined;
    const fc = fabricRef.current;

    if (playback.playing) {
      if (entry) void entry.videoEl.play();
      const loop = () => {
        if (fc) {
          fc.requestRenderAll();
          const t = entry?.videoEl.currentTime ?? 0;
          useEditorStore.getState().setCurrentTime(t);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (entry) entry.videoEl.pause();
      cancelAnimationFrame(rafRef.current);
      if (fc) fc.requestRenderAll();
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [playback.playing]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback(
    (t: number) => {
      const mediaId = activeMediaIdRef.current;
      const entry = mediaId ? videoMapRef.current.get(mediaId) : undefined;
      if (entry) entry.videoEl.currentTime = t;
      setCurrentTime(t);
      fabricRef.current?.requestRenderAll();
    },
    [setCurrentTime],
  );

  const togglePlay = useCallback(() => {
    setPlaying(!playback.playing);
  }, [playback.playing, setPlaying]);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-6"
      >
        <canvas ref={canvasElRef} className="shadow-2xl ring-1 ring-white/10" />
      </div>

      {/* Playback controls */}
      <div className="flex-shrink-0 bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex-shrink-0"
          aria-label={playback.playing ? 'Pause' : 'Play'}
        >
          {playback.playing ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Current time */}
        <span className="text-xs text-gray-300 font-mono tabular-nums w-10 flex-shrink-0">
          {formatTime(playback.currentTime)}
        </span>

        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={playback.duration || 1}
          step={0.01}
          value={playback.currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="flex-1 h-1 rounded accent-indigo-500 cursor-pointer"
        />

        {/* Duration */}
        <span className="text-xs text-gray-500 font-mono tabular-nums w-10 flex-shrink-0 text-right">
          {formatTime(playback.duration)}
        </span>
      </div>
    </div>
  );
}
