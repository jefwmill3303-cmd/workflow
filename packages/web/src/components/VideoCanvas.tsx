import { useCallback, useEffect, useRef } from 'react';
import { Canvas as FabricCanvas, FabricImage, IText, Shadow, Rect } from 'fabric';
import {
  useEditorStore,
  type TimelineClip,
  type TextObject,
  type VideoOverlay,
  type OverlayAnimation,
  type ClipFade,
} from '../stores/editorStore.js';
import { createChromaKeyGL, type ChromaKeyGL } from '../utils/chromaKey.js';
import {
  resumeAudio,
  connectMediaElement,
  setTrackGain,
  setFadeGain,
  decodeWaveform,
} from '../utils/audioEngine.js';

const LOGICAL_W = 1080;
const LOGICAL_H = 1920;
const IMAGE_DEFAULT_DURATION = 5;
const ANIM_DURATION  = 0.6;
const OVERLAY_ANIM_DUR = 0.5;

// ── Media entry types ─────────────────────────────────────────────────────────
type VideoEntry = {
  kind: 'video';
  videoEl:    HTMLVideoElement;
  fabricImg:  FabricImage;
  ckGL?:      ChromaKeyGL;
  baseLeft:   number;
  baseTop:    number;
  baseScaleX: number;
  baseScaleY: number;
};
type AudioEntry = { kind: 'audio'; audioEl: HTMLAudioElement };
type ImageEntry = { kind: 'image'; fabricImg: FabricImage };
type TextEntry  = { kind: 'text';  fabricObj: IText };
type MediaEntry = VideoEntry | AudioEntry | ImageEntry | TextEntry;

function getFabObj(e: MediaEntry): FabricImage | IText | null {
  if (e.kind === 'audio') return null;
  return e.kind === 'text' ? e.fabricObj : e.fabricImg;
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Easing ────────────────────────────────────────────────────────────────────
function easeOut(t: number): number { return 1 - Math.pow(1 - t, 2); }

// ── Compute fade gain for a clip at a given time ──────────────────────────────
function computeFadeGain(clip: TimelineClip, timelineTime: number, fade: ClipFade): number {
  const elapsed   = timelineTime - clip.startTime;
  const clipDur   = clip.outPoint - clip.inPoint;
  const remaining = clipDur - elapsed;
  let gain = 1;
  if (fade.fadeIn  > 0 && elapsed   < fade.fadeIn)  gain  = Math.min(1, elapsed   / fade.fadeIn);
  if (fade.fadeOut > 0 && remaining < fade.fadeOut)  gain  = Math.min(gain, remaining / fade.fadeOut);
  return Math.max(0, gain);
}

// ── Text entrance animation ───────────────────────────────────────────────────
function applyTextAnim(fab: IText, textObj: TextObject, clip: TimelineClip, time: number) {
  if (textObj.animation === 'none') { fab.opacity = 1; return; }
  const elapsed = time - clip.startTime;
  const t = Math.min(1, Math.max(0, elapsed / ANIM_DURATION));
  const e = easeOut(t);

  switch (textObj.animation) {
    case 'fade-in':    fab.opacity = e; break;
    case 'slide-up':   fab.opacity = e; fab.set({ top: textObj.y + (1 - e) * 100 }); break;
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

// ── Video overlay entry/exit animation ────────────────────────────────────────
function applyOverlayAnim(entry: VideoEntry, overlay: VideoOverlay, clip: TimelineClip, time: number) {
  const fab     = entry.fabricImg;
  const clipDur = clip.outPoint - clip.inPoint;
  const elapsed  = time - clip.startTime;
  const remaining = clipDur - elapsed;

  let opacity = overlay.opacity, dX = 0, dY = 0, scale = 1;

  function applyAnim(anim: OverlayAnimation, progress: number, reverse: boolean) {
    const e    = easeOut(progress);
    const sign = reverse ? e : (1 - e);
    switch (anim) {
      case 'fade':        opacity   *= reverse ? (1 - e) : e;                    break;
      case 'slide-left':  dX         = -sign * LOGICAL_W * 0.4;                  break;
      case 'slide-right': dX         =  sign * LOGICAL_W * 0.4;                  break;
      case 'slide-top':   dY         = -sign * LOGICAL_H * 0.4;                  break;
      case 'slide-bottom':dY         =  sign * LOGICAL_H * 0.4;                  break;
      case 'scale-up':    scale      *= reverse ? (1 - 0.7 * e) : (0.3 + 0.7 * e); break;
    }
  }

  if (overlay.entryAnimation !== 'none')
    applyAnim(overlay.entryAnimation, Math.min(1, elapsed / OVERLAY_ANIM_DUR), false);
  if (overlay.exitAnimation !== 'none')
    applyAnim(overlay.exitAnimation, Math.min(1, Math.max(0, 1 - remaining / OVERLAY_ANIM_DUR)), true);

  fab.set({
    opacity,
    left:   entry.baseLeft   + dX,
    top:    entry.baseTop    + dY,
    scaleX: entry.baseScaleX * scale,
    scaleY: entry.baseScaleY * scale,
  });
}

// ── Helpers for text and overlay styles ───────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function syncTextStyles(fab: IText, textObj: TextObject) {
  fab.set({
    fontSize:        textObj.fontSize,
    fontFamily:      textObj.fontFamily,
    fontWeight:      textObj.fontWeight,
    fontStyle:       textObj.fontStyle,
    fill:            textObj.fill,
    stroke:          textObj.strokeWidth > 0 ? textObj.stroke : undefined,
    strokeWidth:     textObj.strokeWidth,
    textAlign:       textObj.textAlign,
    backgroundColor: textObj.backgroundOpacity > 0
      ? hexToRgba(textObj.backgroundColor, textObj.backgroundOpacity) : '',
    shadow: textObj.shadow
      ? new Shadow({ color: textObj.shadowColor, offsetX: textObj.shadowOffsetX,
                     offsetY: textObj.shadowOffsetY, blur: textObj.shadowBlur })
      : null,
  });
  if (!fab.isEditing) fab.set({ text: textObj.text });
}

function syncOverlayStyle(entry: VideoEntry, overlay: VideoOverlay) {
  const fab = entry.fabricImg;
  fab.set({ opacity: overlay.opacity });
  fab.set(overlay.border.enabled
    ? { stroke: overlay.border.color, strokeWidth: overlay.border.width }
    : { stroke: undefined, strokeWidth: 0 });
  fab.set({ shadow: overlay.dropShadow
    ? new Shadow({ color: 'rgba(0,0,0,0.6)', offsetX: 10, offsetY: 10, blur: 20 })
    : null });

  const hasCrop   = overlay.crop.top > 0 || overlay.crop.right > 0 ||
                    overlay.crop.bottom > 0 || overlay.crop.left > 0;
  const hasRadius = overlay.border.enabled && overlay.border.radius > 0;
  if (hasCrop || hasRadius) {
    const w = fab.width ?? 0, h = fab.height ?? 0;
    fab.clipPath = new Rect({
      originX: 'left', originY: 'top',
      left: -w / 2 + overlay.crop.left,
      top:  -h / 2 + overlay.crop.top,
      width:  Math.max(1, w - overlay.crop.left - overlay.crop.right),
      height: Math.max(1, h - overlay.crop.top  - overlay.crop.bottom),
      rx: hasRadius ? overlay.border.radius : 0,
      ry: hasRadius ? overlay.border.radius : 0,
    });
  } else {
    fab.clipPath = undefined;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function VideoCanvas() {
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef    = useRef<FabricCanvas | null>(null);
  const mediaMapRef  = useRef<Map<string, MediaEntry>>(new Map());
  const rafRef       = useRef<number>(0);

  const mediaToLoad         = useEditorStore((s) => s.mediaToLoad);
  const playing             = useEditorStore((s) => s.playback.playing);
  const currentTime         = useEditorStore((s) => s.playback.currentTime);
  const textObjects         = useEditorStore((s) => s.textObjects);
  const videoOverlays       = useEditorStore((s) => s.videoOverlays);
  const mixerTracks         = useEditorStore((s) => s.mixerTracks);
  const deleteObjectId      = useEditorStore((s) => s.deleteObjectId);
  const clearMediaToLoad    = useEditorStore((s) => s.clearMediaToLoad);
  const addCanvasObject     = useEditorStore((s) => s.addCanvasObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const setPlaying          = useEditorStore((s) => s.setPlaying);
  const setCurrentTime      = useEditorStore((s) => s.setCurrentTime);
  const setDuration         = useEditorStore((s) => s.setDuration);
  const addMediaToTimeline  = useEditorStore((s) => s.addMediaToTimeline);
  const setVideoOverlay     = useEditorStore((s) => s.setVideoOverlay);
  const setWaveformData     = useEditorStore((s) => s.setWaveformData);
  const clearDeleteObjectId = useEditorStore((s) => s.clearDeleteObjectId);

  // ── Delete object on store signal ────────────────────────────────────────
  useEffect(() => {
    if (!deleteObjectId) return;
    const fc = fabricRef.current;
    if (fc) {
      const entry = mediaMapRef.current.get(deleteObjectId);
      if (entry) {
        const fab = getFabObj(entry);
        if (fab) fc.remove(fab);
        if (entry.kind === 'video') { entry.videoEl.pause(); entry.videoEl.src = ''; entry.ckGL?.destroy(); }
        if (entry.kind === 'audio') { entry.audioEl.pause(); entry.audioEl.src = ''; }
        mediaMapRef.current.delete(deleteObjectId);
        fc.discardActiveObject();
        fc.requestRenderAll();
      }
    }
    clearDeleteObjectId();
  }, [deleteObjectId, clearDeleteObjectId]);

  // ── Google Fonts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('gfonts-clipflow')) return;
    const link = document.createElement('link');
    link.id = 'gfonts-clipflow'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;700&family=Raleway:ital,wght@0,400;0,700;1,400&family=Roboto:ital,wght@0,400;0,700;1,400&family=Open+Sans:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(link);
  }, []);

  // ── Sync mixerTracks → audio gain nodes ──────────────────────────────────
  useEffect(() => {
    for (const [trackId, mixer] of Object.entries(mixerTracks)) {
      setTrackGain(trackId, mixer.volume, mixer.muted);
    }
  }, [mixerTracks]);

  // ── Visibility + animations ───────────────────────────────────────────────
  const updateVisibility = useCallback((time: number) => {
    const { timelineTracks, textObjects: txts, videoOverlays: overlays } = useEditorStore.getState();
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
      if (entry.kind === 'audio') continue; // audio visibility handled by play loop

      const should = visibleIds.has(id);
      const fab    = getFabObj(entry);
      if (!fab) continue;
      if (fab.visible !== should) fab.visible = should;

      if (should) {
        if (entry.kind === 'text') {
          const txtObj = txts[id];
          for (const track of timelineTracks) {
            const clip = track.clips.find((c) => c.mediaFileId === id);
            if (clip && txtObj) { applyTextAnim(entry.fabricObj, txtObj, clip, time); break; }
          }
        } else if (entry.kind === 'video') {
          const overlay = overlays[id];
          if (overlay) {
            for (const track of timelineTracks) {
              const clip = track.clips.find((c) => c.mediaFileId === id);
              if (clip) {
                if (overlay.entryAnimation !== 'none' || overlay.exitAnimation !== 'none') {
                  applyOverlayAnim(entry, overlay, clip, time);
                } else {
                  fab.set({ opacity: overlay.opacity, left: entry.baseLeft, top: entry.baseTop,
                            scaleX: entry.baseScaleX, scaleY: entry.baseScaleY });
                }
                break;
              }
            }
          }
        }
      } else if (entry.kind === 'video') {
        const overlay = overlays[id];
        entry.fabricImg.set({ opacity: overlay?.opacity ?? 1, left: entry.baseLeft,
          top: entry.baseTop, scaleX: entry.baseScaleX, scaleY: entry.baseScaleY });
      }
    }
  }, []);

  // ── Init Fabric canvas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const rect  = container.getBoundingClientRect();
    const scale = Math.min(rect.width / LOGICAL_W, rect.height / LOGICAL_H);

    const fc = new FabricCanvas(canvasElRef.current, {
      width: LOGICAL_W * scale, height: LOGICAL_H * scale, backgroundColor: '#111111',
    });
    fc.setZoom(scale);
    fabricRef.current = fc;

    fc.on('selection:created', (e) => {
      const id = (e.selected?.[0] as { data?: { objectId?: string } } | undefined)?.data?.objectId;
      if (id) setSelectedObjectId(id);
    });
    fc.on('selection:updated', (e) => {
      const id = (e.selected?.[0] as { data?: { objectId?: string } } | undefined)?.data?.objectId;
      if (id) setSelectedObjectId(id);
    });
    fc.on('selection:cleared', () => setSelectedObjectId(null));

    // Text tool
    fc.on('mouse:down', (evt) => {
      const { activeTool } = useEditorStore.getState();
      if (activeTool !== 'text') return;
      if (evt.target) return;
      const pointer = fc.getScenePoint(evt.e);
      const id = crypto.randomUUID();
      const itext = new IText('New Text', {
        left: pointer.x, top: pointer.y, originX: 'center', originY: 'center',
        fontSize: 90, fontFamily: 'Arial', fill: '#ffffff', textAlign: 'center', editable: true,
      });
      (itext as IText & { data: Record<string, unknown> }).data = { objectId: id, kind: 'text' };
      fc.add(itext);
      fc.setActiveObject(itext);
      fc.requestRenderAll();
      mediaMapRef.current.set(id, { kind: 'text', fabricObj: itext });
      const defaultTxt: TextObject = {
        id, text: 'New Text', x: pointer.x, y: pointer.y, fontSize: 90, fontFamily: 'Arial',
        fontWeight: 'normal', fontStyle: 'normal', fill: '#ffffff', stroke: '#000000',
        strokeWidth: 0, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0,
        shadow: false, shadowColor: '#000000', shadowOffsetX: 4, shadowOffsetY: 4,
        shadowBlur: 10, animation: 'none',
      };
      useEditorStore.getState().addTextObject(defaultTxt);
      useEditorStore.getState().setActiveTool('select');
      useEditorStore.getState().setSelectedObjectId(id);
      itext.on('editing:exited', () => {
        const s = useEditorStore.getState();
        s.updateTextObject(id, { text: itext.text });
        for (const track of s.timelineTracks) {
          const clip = track.clips.find((c) => c.mediaFileId === id);
          if (clip) { s.updateClip(track.id, clip.id, { label: itext.text.slice(0, 20) || 'Text' }); break; }
        }
      });
      itext.on('moving', () => {
        useEditorStore.getState().updateTextObject(id, { x: itext.left ?? 0, y: itext.top ?? 0 });
      });
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
        if (entry.kind === 'video') { entry.videoEl.pause(); entry.videoEl.src = ''; entry.ckGL?.destroy(); }
        if (entry.kind === 'audio') { entry.audioEl.pause(); entry.audioEl.src = ''; }
      });
      mediaMapRef.current.clear();
      void fc.dispose();
      fabricRef.current = null;
    };
  }, [setSelectedObjectId]);

  // ── Sync textObjects → Fabric ─────────────────────────────────────────────
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

  // ── Sync videoOverlays → Fabric + chroma key ─────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    for (const [id, overlay] of Object.entries(videoOverlays)) {
      const entry = mediaMapRef.current.get(id);
      if (entry?.kind !== 'video') continue;
      if (overlay.chromaKey.enabled && !entry.ckGL) {
        const w = entry.videoEl.videoWidth || 1920, h = entry.videoEl.videoHeight || 1080;
        const gl = createChromaKeyGL(w, h);
        if (gl) {
          entry.ckGL = gl;
          gl.setParams(overlay.chromaKey);
          entry.fabricImg.setElement(gl.canvas as HTMLCanvasElement & HTMLVideoElement);
        }
      } else if (!overlay.chromaKey.enabled && entry.ckGL) {
        entry.ckGL.destroy();
        entry.ckGL = undefined;
        entry.fabricImg.setElement(entry.videoEl as HTMLVideoElement & HTMLCanvasElement);
      } else if (overlay.chromaKey.enabled && entry.ckGL) {
        entry.ckGL.setParams(overlay.chromaKey);
      }
      syncOverlayStyle(entry, overlay);
    }
    fc.requestRenderAll();
  }, [videoOverlays]);

  // ── Helper: find trackId for a media file after it's been added ───────────
  function findTrackForMedia(mediaId: string): string | undefined {
    return useEditorStore.getState().timelineTracks.find(
      (t) => t.clips.some((c) => c.mediaFileId === mediaId)
    )?.id;
  }

  // ── Load media onto canvas ────────────────────────────────────────────────
  useEffect(() => {
    if (!mediaToLoad || !fabricRef.current) return;
    const fc   = fabricRef.current;
    const file = mediaToLoad;
    clearMediaToLoad();

    // ── VIDEO ──────────────────────────────────────────────────────────────
    if (file.type === 'VIDEO') {
      if (mediaMapRef.current.has(file.id)) {
        const existing = mediaMapRef.current.get(file.id) as VideoEntry;
        fc.setActiveObject(existing.fabricImg);
        fc.requestRenderAll();
        return;
      }

      const hasExistingVideo = [...mediaMapRef.current.values()].some((e) => e.kind === 'video');
      const videoEl = document.createElement('video');
      videoEl.src = file.url; videoEl.crossOrigin = 'anonymous';
      videoEl.loop = false; videoEl.playsInline = true; videoEl.muted = false;
      videoEl.preload = 'metadata'; videoEl.load();

      videoEl.addEventListener('loadedmetadata', () => {
        const { videoWidth, videoHeight, duration } = videoEl;
        const scaleX = hasExistingVideo
          ? (LOGICAL_W * 0.4) / (videoWidth || LOGICAL_W)
          : LOGICAL_W / (videoWidth || LOGICAL_W);
        const left = hasExistingVideo ? LOGICAL_W * 0.7 : LOGICAL_W / 2;
        const top  = hasExistingVideo ? LOGICAL_H * 0.3 : LOGICAL_H / 2;

        const fabricImg = new FabricImage(videoEl, {
          originX: 'center', originY: 'center', left, top, scaleX, scaleY: scaleX,
        });
        (fabricImg as FabricImage & { data: Record<string, unknown> }).data = {
          mediaId: file.id, objectId: file.id,
        };

        const entry: VideoEntry = {
          kind: 'video', videoEl, fabricImg, ckGL: undefined,
          baseLeft: left, baseTop: top, baseScaleX: scaleX, baseScaleY: scaleX,
        };
        mediaMapRef.current.set(file.id, entry);
        fabricImg.on('moving',  () => { entry.baseLeft = fabricImg.left ?? entry.baseLeft; entry.baseTop = fabricImg.top ?? entry.baseTop; });
        fabricImg.on('scaling', () => { entry.baseScaleX = fabricImg.scaleX ?? entry.baseScaleX; entry.baseScaleY = fabricImg.scaleY ?? entry.baseScaleY; });

        fc.add(fabricImg);
        fc.requestRenderAll();

        const store = useEditorStore.getState();
        store.setDuration(Math.max(store.playback.duration, duration));
        if (!hasExistingVideo) store.setCurrentTime(0);
        store.addCanvasObject({ id: file.id, mediaId: file.id, type: 'VIDEO', filename: file.filename,
          x: left, y: top, width: videoWidth, height: videoHeight, scaleX, scaleY: scaleX });
        store.addMediaToTimeline(file, duration);
        store.setVideoOverlay(file.id, {
          id: file.id,
          chromaKey: { enabled: false, color: '#00ff00', similarity: 0.4, smoothness: 0.1, spillSuppress: 0.5 },
          opacity: 1, border: { enabled: false, color: '#ffffff', width: 2, radius: 0 },
          dropShadow: false, crop: { top: 0, right: 0, bottom: 0, left: 0 },
          entryAnimation: 'none', exitAnimation: 'none',
        });

        // Connect to audio engine
        const trackId = findTrackForMedia(file.id);
        if (trackId) connectMediaElement(file.id, videoEl, trackId);

        // Decode waveform
        decodeWaveform(file.url)
          .then((data) => useEditorStore.getState().setWaveformData(file.id, data))
          .catch(() => {});

        videoEl.addEventListener('ended', () => useEditorStore.getState().setPlaying(false));
      }, { once: true });

    // ── AUDIO ──────────────────────────────────────────────────────────────
    } else if (file.type === 'AUDIO') {
      if (mediaMapRef.current.has(file.id)) return;

      const audioEl = document.createElement('audio');
      audioEl.src = file.url; audioEl.crossOrigin = 'anonymous';
      audioEl.loop = false; audioEl.preload = 'metadata'; audioEl.load();

      audioEl.addEventListener('loadedmetadata', () => {
        const { duration } = audioEl;
        mediaMapRef.current.set(file.id, { kind: 'audio', audioEl });

        const store = useEditorStore.getState();
        store.setDuration(Math.max(store.playback.duration, duration));
        store.addMediaToTimeline(file, duration);

        const trackId = findTrackForMedia(file.id);
        if (trackId) connectMediaElement(file.id, audioEl, trackId);

        decodeWaveform(file.url)
          .then((data) => useEditorStore.getState().setWaveformData(file.id, data))
          .catch(() => {});

        audioEl.addEventListener('ended', () => useEditorStore.getState().setPlaying(false));
      }, { once: true });

    // ── IMAGE ──────────────────────────────────────────────────────────────
    } else if (file.type === 'IMAGE') {
      FabricImage.fromURL(file.url, { crossOrigin: 'anonymous' })
        .then((img) => {
          img.set({ originX: 'center', originY: 'center', left: LOGICAL_W / 2, top: LOGICAL_H / 2 });
          const scaleX = LOGICAL_W / (img.width || LOGICAL_W);
          img.set({ scaleX, scaleY: scaleX });
          (img as FabricImage & { data: Record<string, unknown> }).data = { mediaId: file.id, objectId: file.id };
          fc.add(img);
          fc.requestRenderAll();
          mediaMapRef.current.set(file.id, { kind: 'image', fabricImg: img });
          const store = useEditorStore.getState();
          store.addCanvasObject({ id: file.id, mediaId: file.id, type: 'IMAGE', filename: file.filename,
            x: LOGICAL_W / 2, y: LOGICAL_H / 2, width: img.width ?? 0, height: img.height ?? 0, scaleX, scaleY: scaleX });
          store.addMediaToTimeline(file, IMAGE_DEFAULT_DURATION);
        })
        .catch(console.error);
    }
  }, [mediaToLoad, clearMediaToLoad, addCanvasObject, addMediaToTimeline, setDuration, setVideoOverlay, setWaveformData]);

  // ── Play / pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;

    if (playing) {
      resumeAudio();

      const loop = () => {
        if (!fc) { rafRef.current = requestAnimationFrame(loop); return; }
        const { activeClipId, timelineTracks, playback, clipFades } = useEditorStore.getState();
        if (!playback.playing) return;

        // Master clock from active clip's video
        let timelineTime = playback.currentTime;
        for (const track of timelineTracks) {
          const c = track.clips.find((cl) => cl.id === activeClipId);
          if (c) {
            const ve = mediaMapRef.current.get(c.mediaFileId);
            if (ve?.kind === 'video') timelineTime = c.startTime + (ve.videoEl.currentTime - c.inPoint);
            break;
          }
        }

        // Sync all media entries
        for (const [id, entry] of mediaMapRef.current) {
          // Update GL canvas for chroma key
          if (entry.kind === 'video' && entry.ckGL) entry.ckGL.update(entry.videoEl);

          // Find clip for this media
          for (const track of timelineTracks) {
            const c = track.clips.find((cl) => cl.mediaFileId === id);
            if (!c) continue;

            const clipEnd = c.startTime + (c.outPoint - c.inPoint);
            const inRange = timelineTime >= c.startTime && timelineTime < clipEnd;

            if (entry.kind === 'video' && c.id !== activeClipId) {
              if (inRange) {
                const target = c.inPoint + (timelineTime - c.startTime);
                if (Math.abs(entry.videoEl.currentTime - target) > 0.2) entry.videoEl.currentTime = target;
                if (entry.videoEl.paused) void entry.videoEl.play();
              } else {
                if (!entry.videoEl.paused) entry.videoEl.pause();
              }
            }

            if (entry.kind === 'audio') {
              if (inRange) {
                const target = c.inPoint + (timelineTime - c.startTime);
                if (Math.abs(entry.audioEl.currentTime - target) > 0.2) entry.audioEl.currentTime = target;
                if (entry.audioEl.paused) void entry.audioEl.play();
              } else {
                if (!entry.audioEl.paused) entry.audioEl.pause();
              }
            }

            // Apply fade gain
            if (entry.kind === 'video' || entry.kind === 'audio') {
              const fade = clipFades[c.id];
              if (fade && inRange) setFadeGain(id, computeFadeGain(c, timelineTime, fade));
              else if (!inRange) setFadeGain(id, 0);
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
      for (const [, entry] of mediaMapRef.current) {
        if (entry.kind === 'video') entry.videoEl.pause();
        if (entry.kind === 'audio') entry.audioEl.pause();
      }
      cancelAnimationFrame(rafRef.current);
      if (fc) fc.requestRenderAll();
    }

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, updateVisibility]);

  // ── Seek (when paused) ────────────────────────────────────────────────────
  useEffect(() => {
    if (playing) return;
    const { timelineTracks } = useEditorStore.getState();

    for (const track of timelineTracks) {
      for (const clip of track.clips) {
        const entry = mediaMapRef.current.get(clip.mediaFileId);
        if (!entry || (entry.kind !== 'video' && entry.kind !== 'audio')) continue;
        const clipEnd = clip.startTime + (clip.outPoint - clip.inPoint);
        if (currentTime >= clip.startTime && currentTime < clipEnd) {
          const target  = clip.inPoint + (currentTime - clip.startTime);
          const clamped = Math.max(0, Math.min(target, clip.outPoint));
          const el = entry.kind === 'video' ? entry.videoEl : entry.audioEl;
          if (Math.abs(el.currentTime - clamped) > 0.05) el.currentTime = clamped;
          if (entry.kind === 'video' && entry.ckGL) {
            setTimeout(() => (entry as VideoEntry).ckGL?.update((entry as VideoEntry).videoEl), 80);
          }
        }
      }
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
        <input type="range" min={0} max={duration || 1} step={0.01} value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="flex-1 h-1 rounded accent-indigo-500 cursor-pointer" />
        <span className="text-xs text-gray-500 font-mono tabular-nums w-10 flex-shrink-0 text-right">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
