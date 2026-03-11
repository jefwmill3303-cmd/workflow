import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { MediaFile } from '../stores/editorStore.js';

export type { MediaFile };

interface Props {
  projectId: string;
  onFileClick?: (file: MediaFile) => void;
}

const ACCEPTED = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/wave': ['.wav'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

function FileIcon({ type }: { type: MediaFile['type'] }) {
  if (type === 'VIDEO') {
    return (
      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    );
  }
  if (type === 'AUDIO') {
    return (
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaLibrary({ projectId, onFileClick }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/media/${projectId}`);
      const json = (await res.json()) as { success: boolean; data: MediaFile[] };
      if (json.success) setFiles(json.data);
    } catch {
      setError('Failed to load media');
    }
  }, [projectId]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of accepted) {
          const form = new FormData();
          form.append('file', file);
          form.append('projectId', projectId);
          const res = await fetch('/api/media/upload', { method: 'POST', body: form });
          const json = (await res.json()) as { success: boolean; message?: string };
          if (!json.success) throw new Error(json.message ?? 'Upload failed');
        }
        await fetchFiles();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [projectId, fetchFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Media
        </h2>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`mx-3 mt-3 mb-2 rounded-lg border-2 border-dashed p-3 text-center cursor-pointer transition-colors flex-shrink-0 ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-900/20'
            : 'border-gray-700 hover:border-indigo-600 hover:bg-gray-800'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p className="text-xs text-indigo-400">Uploading…</p>
        ) : isDragActive ? (
          <p className="text-xs text-indigo-400">Drop files here</p>
        ) : (
          <>
            <p className="text-xs text-gray-400">Drop or click to upload</p>
            <p className="text-xs text-gray-600 mt-0.5">MP4 MOV WEBM MP3 WAV PNG JPG</p>
          </>
        )}
      </div>

      {error && (
        <p className="mx-3 mb-2 text-xs text-red-400 bg-red-900/20 rounded p-2 flex-shrink-0">
          {error}
        </p>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {files.length === 0 && !uploading && (
          <p className="text-xs text-gray-600 text-center py-6">No media yet</p>
        )}
        {files.map((f) => (
          <div
            key={f.id}
            onClick={() => onFileClick?.(f)}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
              onFileClick
                ? 'hover:bg-gray-700 active:bg-gray-600'
                : 'hover:bg-gray-800'
            }`}
          >
            {/* Thumbnail */}
            <div className="flex-shrink-0 w-12 h-9 rounded bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-700">
              {f.type === 'IMAGE' ? (
                <img
                  src={f.url}
                  alt={f.filename}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <FileIcon type={f.type} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-200 truncate font-medium" title={f.filename}>
                {f.filename}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-xs px-1 py-px rounded font-medium ${
                    f.type === 'VIDEO'
                      ? 'bg-indigo-900/60 text-indigo-400'
                      : f.type === 'AUDIO'
                      ? 'bg-green-900/60 text-green-400'
                      : 'bg-yellow-900/60 text-yellow-400'
                  }`}
                >
                  {f.type.toLowerCase()}
                </span>
                {f.duration != null && (
                  <span className="text-xs text-gray-500">{formatDuration(f.duration)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
