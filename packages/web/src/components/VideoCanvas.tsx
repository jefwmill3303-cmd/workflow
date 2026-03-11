import { useCallback, useEffect, useRef } from 'react';
import { Canvas as FabricCanvas, FabricImage, IText, Shadow } from 'fabric';
import { useEditorStore, type TimelineClip, type TextObject } from '../stores/editorStore.js';

const LOGICAL_W = 1080;
const LOGICAL_H = 1920;
const IMAGE_DEFAULT_DURATION = 5;
const TEXT_DEFAULT_DURATION = 5;
const ANIM_DURATION = 0.6; // seconds for entrance animation

// ── Media entry types ─────────────────────────────────────────────────────────
type VideoEntry = { kind: 'video'; videoEl: HTMLVideoElement; fabricImg: FabricImage };
type ImageEntry = { kind: 'image'; fabricImg: FabricImage };
type TextEntry  = { kind: 'text';  fabricObj: IText };
type MediaEntry = VideoEntry | ImageEntry | TextEntry;

function getFabObj(e: MediaEntry): FabricImage | IText {
  return e.kind === 'text' ? e.fabricObj : e.fabricImg;
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function findActiveClip(): TimelineClip | undefined {
  const { timelineTracks, activeClipId } = useEditorStore.getState();
  for (const track of timelineTracks) {
    const clip = track.clips.find((c) => c.id === activeClipId);
    if (clip) return clip;
  }
  return undefined;
}

// ── Easing ────────────────────────────────────────────────────────────────────
function easeOut(t: number): number { return 1 - Math.pow(1 - t, 2); }

// ── Apply text entrance animation at a given timeline time ───────────────────
function applyTextAnim(
  fab: IText,
  textObj: TextObject,
  clip: TimelineClip,
  time: number,
) {
  if (textObj.animation === 'none') {
    fab.opacity = 1;
    return;
  }
  const elapsed = time - clip.startTime;
  const t = Math.min(1, Math.max(0, elapsed / ANIM_DURATION));
  const e = easeOut(t);

  switch (textObj.animation) {
    case 'fade-in':
      fab.opacity = e;
      break;
    case 'slide-up':
      fab.opacity = e;
      fab.set({ top: textObj.y + (1 - e) * 100 });
      break;
    case 'pop': {
      const s = t < 0.6 ? (1 / 0.6) * t : 1 + 0.12 * Math.sin(((t - 0.6) / 0.4) * Math.PI);
      fab.set({ scaleX: s, scaleY: s });
      fab.opacity = t < 0.1 ? t / 0.1 : 1;
      break;
    }
    case 'typewriter':
      if (!fab.isEditing) {
        const chars = Math.max(1, Math.floor(t * textObj.text.length));
        fab.set({ text: textObj.text.slice(0, chars) });
      }
      break;
  }
}

// ── Convert hex + opacity → CSS rgba ─────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Sync one TextObject's styles → Fabric IText ───────────────────────────────
function syncTextStyles(fab: IText, textObj: TextObject) {
  fab.set({
    fontSize:    textObj.fontSize,
    fontFamily:  textObj.fontFamily,
    fontWeight:  textObj.fontWeight,
    fontStyle:   textObj.fontStyle,
    fill:        textObj.fill,
    stroke:      textObj.strokeWidth > 0 ? textObj.stroke : undefined,
    strokeWidth: textObj.strokeWidth,
    textAlign:   textObj.textAlign,
    backgroundColor:
      textObj.backgroundOpacity > 0
        ? hexToRgba(textObj.backgroundColor, textObj.backgroundOpacity)
        : '',
    shadow: textObj.shadow
      ? new Shadow({
          color:   textObj.shadowColor,
          offsetX: textObj.shadowOffsetX,
          offsetY: textObj.shadowOffsetY,
          blur:    textObj.shadowBlur,
        })
      : null,
  });
  if (!fab.isEditing) fab.set({ text: textObj.text });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function VideoCanvas() {
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef    = useRef<FabricCanvas | null>(null);
  const mediaMapRef  = useRef<Map<string, MediaEntry>>(new Map());
  const rafRef       = useRef<number>(0);

  const mediaToLoad        = useEditorStore((s) => s.mediaToLoad);
  const playing            = useEditorStore((s) => s.playback.playing);
  const currentTime        = useEditorStore((s) => s.playback.currentTime);
  const textObjects        = useEditorStore((s) => s.textObjects);
  const clearMediaToLoad   = useEditorStore((s) => s.clearMediaToLoad);
  const addCanvasObject    = useEditorStore((s) => s.addCanvasObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const setPlaying         = useEditorStore((s) => s.setPlaying);
  const setCurrentTime     = useEditorStore((s) => s.setCurrentTime);
  const setDuration        = useEditorStore((s) => s.setDuration);
  const addMediaToTimeline = useEditorStore((s) => s.addMediaToTimeline);

  // ── Load Google Fonts once ────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('gfonts-clipflow')) return;
    const link = document.createElement('link');
    link.id = 'gfonts-clipflow';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;700&family=Raleway:ital,wght@0,400;0,700;1,400&family=Roboto:ital,wght@0,400;0,700;1,400&family=Open+Sans:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(link);
  }, []);

  // ── Visibility + animation for a given time ───────────────────────────────
  const updateVisibility = useCallback((time: number) => {
    const { timelineTracks, textObjects: txts } = useEditorStore.getState();
    const fc = fabricRef.current;
    if (!fc || timelineTracks.length === 0) return;

    const visibleIds = new Set<string>();
    for (const track of timelineTracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + (clip.outPoint - clip.inPoint);
        if (time >= clip.startTime && time < end) visibleIds.add(clip.mediaFileId);
      }
    }

    for (const [id, entry] of mediaMapRef.current) {
      const should = visibleIds.has(id);
      const fab = getFabObj(entry);
      if (fab.visible !== should) fab.visible = should;

      // Apply animation when visible
      if (should && entry.kind === 'text') {
        const txtObj = txts[id];
        for (const track of timelineTracks) {
          const clip = track.clips.find((c) => c.mediaFileId === id);
          if (clip && txtObj) { applyTextAnim(entry.fabricObj, txtObj, clip, time); break; }
        }
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
      width:  LOGICAL_W * scale,
      height: LOGICAL_H * scale,
      backgroundColor: '#111111',
    });
    fc.setZoom(scale);
    fabricRef.current = fc;

    // Selection events
    fc.on('selection:created', (e) => {
      const id = (e.selected?.[0] as { data?: { objectId?: string } } | undefined)?.data?.objectId;
      if (id) setSelectedObjectId(id);
    });
    fc.on('selection:updated', (e) => {
      const id = (e.selected?.[0] as { data?: { objectId?: string } } | undefined)?.data?.objectId;
      if (id) setSelectedObjectId(id);
    });
    fc.on('selection:cleared', () => setSelectedObjectId(null));

    // Text tool — create IText on canvas click
    fc.on('mouse:down', (evt) => {
      const { activeTool, textObjects: txts } = useEditorStore.getState();
      if (activeTool !== 'text') return;
      if (evt.target) return; // clicked an existing object

      const pointer = fc.getScenePoint(evt.e);
      const id = crypto.randomUUID();

      const itext = new IText('New Text', {
        left:     pointer.x,
        top:      pointer.y,
        originX:  'center',
        originY:  'center',
        fontSize: 90,
        fontFamily: 'Arial',
        fill:     '#ffffff',
        textAlign: 'center',
        editable: true,
      });
      (itext as IText & { data: Record<string, unknown> }).data = { objectId: id, kind: 'text' };

      fc.add(itext);
      fc.setActiveObject(itext);
      fc.requestRenderAll();
      mediaMapRef.current.set(id, { kind: 'text', fabricObj: itext });

      const defaultTxt: TextObject = {
        id,
        text: 'New Text',
        x: pointer.x,
        y: pointer.y,
        fontSize: 90,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        fontStyle: 'normal',
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 0,
        textAlign: 'center',
        backgroundColor: '#000000',
        backgroundOpacity: 0,
        shadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        shadowBlur: 10,
        animation: 'none',
      };
      useEditorStore.getState().addTextObject(defaultTxt);
      useEditorStore.getState().setActiveTool('select');
      useEditorStore.getState().setSelectedObjectId(id);

      // Sync text back when editing exits
      itext.on('editing:exited', () => {
        const s = useEditorStore.getState();
        s.updateTextObject(id, { text: itext.text });
        for (const track of s.timelineTracks) {
          const clip = track.clips.find((c) => c.mediaFileId === id);
          if (clip) {
            s.updateClip(track.id, clip.id, { label: itext.text.slice(0, 20) || 'Text' });
            break;
          }
        }
      });

      // Sync position when moved
      itext.on('moving', () => {
        useEditorStore.getState().updateTextObject(id, { x: itext.left ?? 0, y: itext.top ?? 0 });
      });

      // Enter editing immediately
      setTimeout(() => { fc.setActiveObject(itext); itext.enterEditing(); fc.requestRenderAll(); }, 50);
    });

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
        if (entry.kind === 'video') { entry.videoEl.pause(); entry.videoEl.src = ''; }
      });
      mediaMapRef.current.clear();
      void fc.dispose();
      fabricRef.current = null;
    };
  }, [setSelectedObjectId]);

  // ── Sync textObjects store → Fabric styles ────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    for (const [id, textObj] of Object.entries(textObjects)) {
      const entry = mediaMapRef.current.get(id);
      if (entry?.kind !== 'text') continue;
      syncTextStyles(entry.fabricObj, textObj);
    }
    fc.requestRenderAll();
  }, [textObjects]);

  // ── Load media onto canvas ────────────────────────────────────────────────
  useEffect(() => {
    if (!mediaToLoad || !fabricRef.current) return;
    const fc = fabricRef.current;
    const file = mediaToLoad;
    clearMediaToLoad();

    if (file.type === 'VIDEO') {
      const existing = mediaMapRef.current.get(file.id) as VideoEntry | undefined;
      if (existing) {
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

      videoEl.addEventListener('loadedmetadata', () => {
        const { videoWidth, videoHeight, duration } = videoEl;
        const fabricImg = new FabricImage(videoEl, {
          originX: 'center', originY: 'center',
          left: LOGICAL_W / 2, top: LOGICAL_H / 2,
        });
        const scaleX = LOGICAL_W / (videoWidth || LOGICAL_W);
        fabricImg.set({ scaleX, scaleY: scaleX });
        (fabricImg as FabricImage & { data: Record<string, unknown> }).data = {
          mediaId: file.id, objectId: file.id,
        };

        fc.add(fabricImg);
        fc.requestRenderAll();
        mediaMapRef.current.set(file.id, { kind: 'video', videoEl, fabricImg });

        const store = useEditorStore.getState();
        store.setDuration(Math.max(store.playback.duration, duration));
        store.setCurrentTime(0);
        store.addCanvasObject({
          id: file.id, mediaId: file.id, type: 'VIDEO', filename: file.filename,
          x: LOGICAL_W / 2, y: LOGICAL_H / 2, width: videoWidth, height: videoHeight,
          scaleX, scaleY: scaleX,
        });
        store.addMediaToTimeline(file, duration);

        videoEl.addEventListener('ended', () => useEditorStore.getState().setPlaying(false));
      }, { once: true });

    } else if (file.type === 'IMAGE') {
      FabricImage.fromURL(file.url, { crossOrigin: 'anonymous' })
        .then((img) => {
          img.set({ originX: 'center', originY: 'center', left: LOGICAL_W / 2, top: LOGICAL_H / 2 });
          const scaleX = LOGICAL_W / (img.width || LOGICAL_W);
          img.set({ scaleX, scaleY: scaleX });
          (img as FabricImage & { data: Record<string, unknown> }).data = {
            mediaId: file.id, objectId: file.id,
          };
          fc.add(img);
          fc.requestRenderAll();
          mediaMapRef.current.set(file.id, { kind: 'image', fabricImg: img });

          const store = useEditorStore.getState();
          store.addCanvasObject({
            id: file.id, mediaId: file.id, type: 'IMAGE', filename: file.filename,
            x: LOGICAL_W / 2, y: LOGICAL_H / 2,
            width: img.width ?? 0, height: img.height ?? 0, scaleX, scaleY: scaleX,
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
      const clip = findActiveClip();
      const entry = clip ? (mediaMapRef.current.get(clip.mediaFileId) as VideoEntry | undefined) : undefined;
      if (entry?.kind === 'video') {
        const videoTime = clip!.inPoint + (currentTime - clip!.startTime);
        entry.videoEl.currentTime = Math.max(0, Math.min(videoTime, clip!.outPoint));
        void entry.videoEl.play();
      }

      const loop = () => {
        if (!fc) { rafRef.current = requestAnimationFrame(loop); return; }
        const { activeClipId, timelineTracks, playback } = useEditorStore.getState();
        if (!playback.playing) return;

        let timelineTime = playback.currentTime;
        for (const track of timelineTracks) {
          const c = track.clips.find((cl) => cl.id === activeClipId);
          if (c) {
            const ve = mediaMapRef.current.get(c.mediaFileId);
            if (ve?.kind === 'video') timelineTime = c.startTime + (ve.videoEl.currentTime - c.inPoint);
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
      const clip = findActiveClip();
      const entry = clip ? (mediaMapRef.current.get(clip.mediaFileId) as VideoEntry | undefined) : undefined;
      if (entry?.kind === 'video') entry.videoEl.pause();
      cancelAnimationFrame(rafRef.current);
      if (fc) fc.requestRenderAll();
    }

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, updateVisibility]);

  // ── Seek (when paused) ────────────────────────────────────────────────────
  useEffect(() => {
    if (playing) return;

    const clip = findActiveClip();
    const entry = clip ? (mediaMapRef.current.get(clip.mediaFileId) as VideoEntry | undefined) : undefined;
    if (entry?.kind === 'video' && clip) {
      const videoTime = clip.inPoint + (currentTime - clip.startTime);
      const clamped = Math.max(0, Math.min(videoTime, clip.outPoint));
      if (Math.abs(entry.videoEl.currentTime - clamped) > 0.05) entry.videoEl.currentTime = clamped;
    }

    updateVisibility(currentTime);
    fabricRef.current?.requestRenderAll();
  }, [currentTime, playing, updateVisibility]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => setPlaying(!playing), [playing, setPlaying]);
  const handleSeek = useCallback((t: number) => setCurrentTime(t), [setCurrentTime]);
  const duration   = useEditorStore((s) => s.playback.duration);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-6">
        <canvas ref={canvasElRef} className="shadow-2xl ring-1 ring-white/10" />
      </div>

      <div className="flex-shrink-0 bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex-shrink-0"
        >
          {playing ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
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
          type="range" min={0} max={duration || 1} step={0.01} value={currentTime}
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
