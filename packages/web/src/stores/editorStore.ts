import { create } from 'zustand';

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

interface PlaybackState {
  playing: boolean;
  currentTime: number;
  duration: number;
}

interface EditorState {
  project: Project | null;
  loadedMedia: MediaFile[];
  canvasObjects: CanvasObjectDescriptor[];
  playback: PlaybackState;
  selectedObjectId: string | null;
  /** Set by MediaLibrary click; consumed & cleared by VideoCanvas */
  mediaToLoad: MediaFile | null;

  setProject: (p: Project | null) => void;
  setLoadedMedia: (media: MediaFile[]) => void;
  addCanvasObject: (obj: CanvasObjectDescriptor) => void;
  removeCanvasObject: (id: string) => void;
  updateCanvasObject: (id: string, updates: Partial<CanvasObjectDescriptor>) => void;
  clearCanvasObjects: () => void;
  setPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setSelectedObjectId: (id: string | null) => void;
  requestLoadMedia: (f: MediaFile) => void;
  clearMediaToLoad: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  project: null,
  loadedMedia: [],
  canvasObjects: [],
  playback: { playing: false, currentTime: 0, duration: 0 },
  selectedObjectId: null,
  mediaToLoad: null,

  setProject: (p) => set({ project: p }),
  setLoadedMedia: (media) => set({ loadedMedia: media }),
  addCanvasObject: (obj) => set((s) => ({ canvasObjects: [...s.canvasObjects, obj] })),
  removeCanvasObject: (id) =>
    set((s) => ({ canvasObjects: s.canvasObjects.filter((o) => o.id !== id) })),
  updateCanvasObject: (id, updates) =>
    set((s) => ({
      canvasObjects: s.canvasObjects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),
  clearCanvasObjects: () => set({ canvasObjects: [] }),
  setPlaying: (v) => set((s) => ({ playback: { ...s.playback, playing: v } })),
  setCurrentTime: (t) => set((s) => ({ playback: { ...s.playback, currentTime: t } })),
  setDuration: (d) => set((s) => ({ playback: { ...s.playback, duration: d } })),
  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
  requestLoadMedia: (f) => set({ mediaToLoad: f }),
  clearMediaToLoad: () => set({ mediaToLoad: null }),
}));
