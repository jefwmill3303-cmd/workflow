import { useCallback, useEffect, useRef } from 'react';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { useEditorStore, type TimelineClip } from '../stores/editorStore.js';

const LOGICAL_W = 1080;
const LOGICAL_H = 1920;
const IMAGE_DEFAULT_DURATION = 5; // seconds on timeline for still images

// ── Media entry types ─────────────────────────────────────────────────────────
type VideoEntry = { kind: 'video'; videoEl: HTMLVideoElement; fabricImg: FabricImage };
type ImageEntry = { kind: 'image'; fabricImg: FabricImage };
type MediaEntry = VideoEntry | ImageEntry;

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Helper: find the clip that is "active" for timeline-clock playback ────────
function findActiveClip(): TimelineClip | undefined {
  const { timelineTracks, activeClipId } = useEditorStore.getState();
  for (const track of timelineTracks) {
    const clip = track.clips.find((c) => c.id === activeClipId);
    if (clip) return clip;
  }
  return undefined;
}

export function VideoCanvas() {
  const canvasElRef   = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const fabricRef     = useRef<FabricCanvas | null>(null);
  const mediaMapRef   = useRef<Map<string, MediaEntry>>(new Map());
  const rafRef        = useRef<number>(0);

  const mediaToLoad       = useEditorStore((s) => s.mediaToLoad);
  const playing           = useEditorStore((s) => s.playback.playing);
  const currentTime       = useEditorStore((s) => s.playback.currentTime);
  const clearMediaToLoad  = useEditorStore((s) => s.clearMediaToLoad);
  const addCanvasObject   = useEditorStore((s) => s.addCanvasObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const setPlaying        = useEditorStore((s) => s.setPlaying);
  const setCurrentTime    = useEditorStore((s) => s.setCurrentTime);
  const setDuration       = useEditorStore((s) => s.setDuration);
  const addMediaToTimeline = useEditorStore((s) => s.addMediaToTimeline);

  // ── Update canvas object visibility based on clip timing ─────────────────
  const updateVisibility = useCallback((time: number) => {
    const { timelineTracks } = useEditorStore.getState();
    const fc = fabricRef.current;
    if (!fc) return;

    if (timelineTracks.length === 0) return; // no clips yet — keep everything visible

    // Build set of currently visible media IDs
    const visibleIds = new Set<string>();
    for (const track of timelineTracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + (clip.outPoint - clip.inPoint);
        if (time >= clip.startTime && time < end) {
          visibleIds.add(clip.mediaFileId);
        }
      }
    }

    for (const [id, entry] of mediaMapRef.current) {
      const should = visibleIds.has(id);
      if (entry.fabricImg.visible !== should) {
        entry.fabricImg.visible = should;
      }
    }
  }, []);

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
      const id = (e.selected?.[0] as { data?: { objectId?: string } } | undefined)
        ?.data?.objectId;
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
      mediaMapRef.current.forEach((entry) => {
        if (entry.kind === 'video') {
          entry.videoEl.pause();
          entry.videoEl.src = '';
        }
      });
      mediaMapRef.current.clear();
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
      const existing = mediaMapRef.current.get(file.id) as VideoEntry | undefined;
      if (existing) {
        // Already loaded — make active
        useEditorStore.getState().setActiveClipId(
          useEditorStore.getState().activeClipId, // keep existing or find it
        );
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
          fabricImg.set({ scaleX, scaleY: scaleX });
          (fabricImg as FabricImage & { data: Record<string, unknown> }).data = {
            mediaId: file.id,
            objectId: file.id,
          };

          fc.add(fabricImg);
          fc.requestRenderAll();

          mediaMapRef.current.set(file.id, { kind: 'video', videoEl, fabricImg });

          const store = useEditorStore.getState();
          store.setDuration(Math.max(store.playback.duration, duration));
          store.setCurrentTime(0);
          store.addCanvasObject({
            id: file.id,
            mediaId: file.id,
            type: 'VIDEO',
            filename: file.filename,
            x: LOGICAL_W / 2,
            y: LOGICAL_H / 2,
            width: videoWidth,
            height: videoHeight,
            scaleX,
            scaleY: scaleX,
          });
          store.addMediaToTimeline(file, duration);

          videoEl.addEventListener('ended', () => {
            useEditorStore.getState().setPlaying(false);
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

          mediaMapRef.current.set(file.id, { kind: 'image', fabricImg: img });

          const store = useEditorStore.getState();
          store.addCanvasObject({
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
          store.addMediaToTimeline(file, IMAGE_DEFAULT_DURATION);
        })
        .catch(console.error);
    }
  }, [mediaToLoad, clearMediaToLoad, addCanvasObject, addMediaToTimeline, setDuration]);

  // ── Play / pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;

    if (playing) {
      // Find active video and seek to correct timeline position
      const clip = findActiveClip();
      const entry = clip
        ? (mediaMapRef.current.get(clip.mediaFileId) as VideoEntry | undefined)
        : undefined;

      if (entry?.kind === 'video') {
        const videoTime = clip!.inPoint + (currentTime - clip!.startTime);
        entry.videoEl.currentTime = Math.max(0, Math.min(videoTime, clip!.outPoint));
        void entry.videoEl.play();
      }

      const loop = () => {
        if (!fc) { rafRef.current = requestAnimationFrame(loop); return; }

        const { activeClipId, timelineTracks, playback } = useEditorStore.getState();
        if (!playback.playing) return;

        // Find the clip driving the clock
        let timelineTime = playback.currentTime;
        for (const track of timelineTracks) {
          const c = track.clips.find((cl) => cl.id === activeClipId);
          if (c) {
            const ve = mediaMapRef.current.get(c.mediaFileId);
            if (ve?.kind === 'video') {
              timelineTime = c.startTime + (ve.videoEl.currentTime - c.inPoint);
            }
            break;
          }
        }

        updateVisibility(timelineTime);
        fc.requestRenderAll();
        useEditorStore.getState().setCurrentTime(timelineTime);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      // Pause active video
      const clip = findActiveClip();
      const entry = clip
        ? (mediaMapRef.current.get(clip.mediaFileId) as VideoEntry | undefined)
        : undefined;
      if (entry?.kind === 'video') entry.videoEl.pause();
      cancelAnimationFrame(rafRef.current);
      if (fc) fc.requestRenderAll();
    }

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, updateVisibility]);

  // ── Seek (when not playing — e.g. dragging timeline or seek bar) ──────────
  useEffect(() => {
    if (playing) return; // RAF handles playback sync

    const clip = findActiveClip();
    const entry = clip
      ? (mediaMapRef.current.get(clip.mediaFileId) as VideoEntry | undefined)
      : undefined;

    if (entry?.kind === 'video' && clip) {
      const videoTime = clip.inPoint + (currentTime - clip.startTime);
      const clamped = Math.max(0, Math.min(videoTime, clip.outPoint));
      if (Math.abs(entry.videoEl.currentTime - clamped) > 0.05) {
        entry.videoEl.currentTime = clamped;
      }
    }

    updateVisibility(currentTime);
    fabricRef.current?.requestRenderAll();
  }, [currentTime, playing, updateVisibility]);

  // ── Playback controls ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => setPlaying(!playing), [playing, setPlaying]);

  const handleSeek = useCallback(
    (t: number) => setCurrentTime(t),
    [setCurrentTime],
  );

  const duration = useEditorStore((s) => s.playback.duration);

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
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex-shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
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

        <span className="text-xs text-gray-300 font-mono tabular-nums w-10 flex-shrink-0">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="flex-1 h-1 rounded accent-indigo-500 cursor-pointer"
        />

        <span className="text-xs text-gray-500 font-mono tabular-nums w-10 flex-shrink-0 text-right">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
