import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface MediaFile {
  id: string;
  project_id: string;
  type: 'VIDEO' | 'AUDIO' | 'IMAGE';
  filename: string;
  url: string;
  duration: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Props {
  projectId: string;
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
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    );
  }
  if (type === 'AUDIO') {
    return (
      <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

export function MediaLibrary({ projectId }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/media/${projectId}`);
      const json = await res.json() as { success: boolean; data: MediaFile[] };
      if (json.success) setFiles(json.data);
    } catch {
      setError('Failed to load media files');
    }
  }, [projectId]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of accepted) {
        const form = new FormData();
        form.append('file', file);
        form.append('projectId', projectId);

        const res = await fetch('/api/media/upload', { method: 'POST', body: form });
        const json = await res.json() as { success: boolean; message?: string };
        if (!json.success) throw new Error(json.message ?? 'Upload failed');
      }
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [projectId, fetchFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
        Media Library
      </h2>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`mx-3 mb-3 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p className="text-sm text-indigo-600">Uploading…</p>
        ) : isDragActive ? (
          <p className="text-sm text-indigo-600">Drop files here</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">Drag &amp; drop files here</p>
            <p className="text-xs text-gray-400 mt-1">MP4, MOV, WEBM, MP3, WAV, PNG, JPG</p>
          </>
        )}
      </div>

      {error && (
        <p className="mx-3 mb-2 text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-2">
        {files.length === 0 && !uploading && (
          <p className="text-xs text-gray-400 text-center py-4">No media yet</p>
        )}
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Thumbnail / icon */}
            <div className="flex-shrink-0 w-14 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
              {f.type === 'IMAGE' ? (
                <img
                  src={f.url}
                  alt={f.filename}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <FileIcon type={f.type} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate" title={f.filename}>
                {f.filename}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    f.type === 'VIDEO'
                      ? 'bg-indigo-100 text-indigo-700'
                      : f.type === 'AUDIO'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {f.type.toLowerCase()}
                </span>
                {f.duration != null && (
                  <span className="text-xs text-gray-400">{formatDuration(f.duration)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
