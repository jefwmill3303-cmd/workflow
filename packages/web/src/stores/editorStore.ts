import { create } from 'zustand';

// ── Domain types ─────────────────────────────────────────────────────────────

export interface MediaFile {
  id: string;
  project_id: string;
  type: 'VIDEO' | 'AUDIO' | 'IMAGE';
  filename: string;
  url: string;
  duration: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface CanvasObjectDescriptor {
  id: string;
  mediaId: string;
  type: MediaFile['type'];
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

// ── Audio mixer types ─────────────────────────────────────────────────────────

export interface MixerTrack {
  trackId: string;
  volume:  number;  // 0-2 (0-200%)
  muted:   boolean;
}

export interface ClipFade {
  clipId:  string;
  fadeIn:  number; // seconds
  fadeOut: number; // seconds
}

// ── Video overlay types ───────────────────────────────────────────────────────

export type OverlayAnimation =
  | 'none' | 'fade'
  | 'slide-left' | 'slide-right' | 'slide-top' | 'slide-bottom'
  | 'scale-up';

export interface VideoOverlay {
  id: string;
  chromaKey: {
    enabled:      boolean;
    color:        string;   // hex
    similarity:   number;   // 0-1
    smoothness:   number;   // 0-1
    spillSuppress: number;  // 0-1
  };
  opacity: number;          // 0-1
  border: {
    enabled: boolean;
    color:   string;
    width:   number;
    radius:  number;
  };
  dropShadow: boolean;
  crop: { top: number; right: number; bottom: number; left: number };
  entryAnimation: OverlayAnimation;
  exitAnimation:  OverlayAnimation;
}

// ── Text types ────────────────────────────────────────────────────────────────

export type TextAnimation = 'none' | 'fade-in' | 'slide-up' | 'pop' | 'typewriter';

export interface TextObject {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  fill: string;
  stroke: string;
  strokeWidth: number;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  backgroundOpacity: number;
  shadow: boolean;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  animation: TextAnimation;
}

// ── Timeline types ────────────────────────────────────────────────────────────

export interface TimelineClip {
  id: string;
  mediaFileId: string;
  trackId: string;
  startTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  label: string;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'text';
  label: string;
  clips: TimelineClip[];
}

// ── State interface ───────────────────────────────────────────────────────────

interface PlaybackState {
  playing: boolean;
  currentTime: number;
  duration: number;
}

interface EditorState {
  project: Project | null;
  loadedMedia: MediaFile[];
  canvasObjects: CanvasObjectDescriptor[];
  textObjects: Record<string, TextObject>;
  videoOverlays: Record<string, VideoOverlay>;
  mixerTracks: Record<string, MixerTrack>;
  clipFades: Record<string, ClipFade>;
  waveformData: Record<string, Float32Array>;
  playback: PlaybackState;
  selectedObjectId: string | null;
  mediaToLoad: MediaFile | null;

  // Timeline
  timelineTracks: TimelineTrack[];
  timelineZoom: number;
  activeTool: 'select' | 'split' | 'text';
  activeClipId: string | null;

  // ── Actions ──
  setProject: (p: Project | null) => void;
  setLoadedMedia: (media: MediaFile[]) => void;

  addCanvasObject: (obj: CanvasObjectDescriptor) => void;
  removeCanvasObject: (id: string) => void;
  updateCanvasObject: (id: string, updates: Partial<CanvasObjectDescriptor>) => void;
  clearCanvasObjects: () => void;

  setVideoOverlay: (id: string, overlay: VideoOverlay) => void;
  updateVideoOverlay: (id: string, updates: Partial<VideoOverlay>) => void;

  setMixerTrack: (trackId: string, t: MixerTrack) => void;
  updateMixerTrack: (trackId: string, updates: Partial<MixerTrack>) => void;
  setClipFade: (clipId: string, fade: ClipFade) => void;
  updateClipFade: (clipId: string, updates: Partial<ClipFade>) => void;
  setWaveformData: (mediaFileId: string, data: Float32Array) => void;

  addTextObject: (obj: TextObject) => void;
  updateTextObject: (id: string, updates: Partial<TextObject>) => void;
  removeTextObject: (id: string) => void;

  setPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setSelectedObjectId: (id: string | null) => void;
  requestLoadMedia: (f: MediaFile) => void;
  clearMediaToLoad: () => void;

  // Timeline actions
  addMediaToTimeline: (file: MediaFile, sourceDuration: number) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  removeClip: (trackId: string, clipId: string) => void;
  splitClip: (trackId: string, clipId: string, atTime: number) => void;
  setTimelineZoom: (zoom: number) => void;
  setActiveTool: (tool: 'select' | 'split' | 'text') => void;
  setActiveClipId: (id: string | null) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  loadedMedia: [],
  canvasObjects: [],
  textObjects: {},
  videoOverlays: {},
  mixerTracks: {},
  clipFades: {},
  waveformData: {},
  playback: { playing: false, currentTime: 0, duration: 0 },
  selectedObjectId: null,
  mediaToLoad: null,
  timelineTracks: [],
  timelineZoom: 80,
  activeTool: 'select',
  activeClipId: null,

  setProject: (p) => set({ project: p }),
  setLoadedMedia: (media) => set({ loadedMedia: media }),

  setMixerTrack: (trackId, t) =>
    set((s) => ({ mixerTracks: { ...s.mixerTracks, [trackId]: t } })),
  updateMixerTrack: (trackId, updates) =>
    set((s) => ({
      mixerTracks: {
        ...s.mixerTracks,
        [trackId]: { ...s.mixerTracks[trackId], ...updates } as MixerTrack,
      },
    })),
  setClipFade: (clipId, fade) =>
    set((s) => ({ clipFades: { ...s.clipFades, [clipId]: fade } })),
  updateClipFade: (clipId, updates) =>
    set((s) => ({
      clipFades: {
        ...s.clipFades,
        [clipId]: { ...s.clipFades[clipId], ...updates } as ClipFade,
      },
    })),
  setWaveformData: (mediaFileId, data) =>
    set((s) => ({ waveformData: { ...s.waveformData, [mediaFileId]: data } })),

  setVideoOverlay: (id, overlay) =>
    set((s) => ({ videoOverlays: { ...s.videoOverlays, [id]: overlay } })),
  updateVideoOverlay: (id, updates) =>
    set((s) => ({
      videoOverlays: {
        ...s.videoOverlays,
        [id]: { ...s.videoOverlays[id], ...updates } as VideoOverlay,
      },
    })),

  addCanvasObject: (obj) => set((s) => ({ canvasObjects: [...s.canvasObjects, obj] })),
  removeCanvasObject: (id) =>
    set((s) => ({ canvasObjects: s.canvasObjects.filter((o) => o.id !== id) })),
  updateCanvasObject: (id, updates) =>
    set((s) => ({
      canvasObjects: s.canvasObjects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),
  clearCanvasObjects: () => set({ canvasObjects: [] }),

  // ── Text objects ─────────────────────────────────────────────────────────

  addTextObject: (obj) => {
    set((prev) => {
      const existingTrack = prev.timelineTracks.find((t) => t.type === 'text');
      const trackId = existingTrack?.id ?? crypto.randomUUID();

      const existingClips = existingTrack?.clips ?? [];
      const startTime = prev.playback.currentTime;
      const dur = 5;

      const clipId = crypto.randomUUID();
      const clip: TimelineClip = {
        id: clipId,
        mediaFileId: obj.id,
        trackId,
        startTime,
        duration: dur,
        inPoint: 0,
        outPoint: dur,
        label: obj.text.slice(0, 20) || 'Text',
      };

      const newTrackCount = prev.timelineTracks.filter((t) => t.type === 'text').length;

      return {
        textObjects: { ...prev.textObjects, [obj.id]: obj },
        clipFades: { ...prev.clipFades, [clipId]: { clipId, fadeIn: 0, fadeOut: 0 } },
        timelineTracks: existingTrack
          ? prev.timelineTracks.map((t) =>
              t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
            )
          : [
              ...prev.timelineTracks,
              {
                id: trackId,
                type: 'text' as const,
                label: `Text ${newTrackCount + 1}`,
                clips: [clip],
              },
            ],
        playback: {
          ...prev.playback,
          duration: Math.max(prev.playback.duration, startTime + dur),
        },
      };
    });
  },

  updateTextObject: (id, updates) =>
    set((prev) => ({
      textObjects: {
        ...prev.textObjects,
        [id]: { ...prev.textObjects[id], ...updates } as TextObject,
      },
    })),

  removeTextObject: (id) =>
    set((prev) => {
      const { [id]: _removed, ...rest } = prev.textObjects;
      return { textObjects: rest };
    }),

  setPlaying: (v) => set((s) => ({ playback: { ...s.playback, playing: v } })),
  setCurrentTime: (t) => set((s) => ({ playback: { ...s.playback, currentTime: t } })),
  setDuration: (d) => set((s) => ({ playback: { ...s.playback, duration: d } })),
  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
  requestLoadMedia: (f) => set({ mediaToLoad: f }),
  clearMediaToLoad: () => set({ mediaToLoad: null }),

  // ── Timeline ────────────────────────────────────────────────────────────────

  addMediaToTimeline: (file, sourceDuration) => {
    const s = get();
    const trackType: TimelineTrack['type'] = file.type === 'AUDIO' ? 'audio' : 'video';

    const existingTrack = s.timelineTracks.find((t) => t.type === trackType);
    const trackId = existingTrack?.id ?? crypto.randomUUID();

    const existingClips = existingTrack?.clips ?? [];
    const startTime = existingClips.reduce(
      (max, c) => Math.max(max, c.startTime + (c.outPoint - c.inPoint)),
      0,
    );

    const clipId = crypto.randomUUID();
    const clip: TimelineClip = {
      id: clipId,
      mediaFileId: file.id,
      trackId,
      startTime,
      duration: sourceDuration,
      inPoint: 0,
      outPoint: sourceDuration,
      label: file.filename,
    };

    set((prev) => ({
      timelineTracks: existingTrack
        ? prev.timelineTracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          )
        : [
            ...prev.timelineTracks,
            {
              id: trackId,
              type: trackType,
              label:
                trackType === 'video'
                  ? `Video ${prev.timelineTracks.filter((t) => t.type === 'video').length + 1}`
                  : `Audio ${prev.timelineTracks.filter((t) => t.type === 'audio').length + 1}`,
              clips: [clip],
            },
          ],
      activeClipId: clipId,
      playback: {
        ...prev.playback,
        duration: Math.max(prev.playback.duration, startTime + sourceDuration),
      },
      mixerTracks: {
        ...prev.mixerTracks,
        [trackId]: prev.mixerTracks[trackId] ?? { trackId, volume: 1, muted: false },
      },
      clipFades: {
        ...prev.clipFades,
        [clipId]: { clipId, fadeIn: 0, fadeOut: 0 },
      },
    }));
  },

  updateClip: (trackId, clipId, updates) => {
    set((s) => ({
      timelineTracks: s.timelineTracks.map((track) =>
        track.id !== trackId
          ? track
          : {
              ...track,
              clips: track.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
            },
      ),
    }));
  },

  removeClip: (trackId, clipId) => {
    set((s) => ({
      timelineTracks: s.timelineTracks.map((track) =>
        track.id !== trackId
          ? track
          : { ...track, clips: track.clips.filter((c) => c.id !== clipId) },
      ),
    }));
  },

  splitClip: (trackId, clipId, atTime) => {
    const track = get().timelineTracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const clipEnd = clip.startTime + (clip.outPoint - clip.inPoint);
    if (atTime <= clip.startTime || atTime >= clipEnd) return;

    const splitSourceTime = clip.inPoint + (atTime - clip.startTime);
    const clipA: TimelineClip = { ...clip, outPoint: splitSourceTime };
    const clipB: TimelineClip = {
      ...clip,
      id: crypto.randomUUID(),
      startTime: atTime,
      inPoint: splitSourceTime,
    };

    const origFade = get().clipFades[clipId] ?? { clipId, fadeIn: 0, fadeOut: 0 };
    set((s) => ({
      timelineTracks: s.timelineTracks.map((t) =>
        t.id !== trackId
          ? t
          : { ...t, clips: t.clips.flatMap((c) => (c.id === clipId ? [clipA, clipB] : [c])) },
      ),
      clipFades: {
        ...s.clipFades,
        [clipId]:  { ...origFade, clipId,   fadeOut: 0 },
        [clipB.id]: { clipId: clipB.id, fadeIn: 0, fadeOut: origFade.fadeOut },
      },
    }));
  },

  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveClipId: (id) => set({ activeClipId: id }),
}));
