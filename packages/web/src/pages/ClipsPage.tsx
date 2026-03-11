import { useEffect, useState } from 'react';
import type { Clip, PaginatedResponse } from '@clipflow/shared';

export function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clips')
      .then((res) => res.json() as Promise<PaginatedResponse<Clip>>)
      .then((data) => {
        setClips(data.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load clips');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading clips...</div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-500">{error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Clips</h1>
      </div>
      {clips.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No clips yet. Add some clips via the API.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h2 className="font-semibold text-gray-900 truncate">{clip.title}</h2>
              {clip.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{clip.description}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    clip.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : clip.status === 'archived'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {clip.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
