import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MediaLibrary } from '../components/MediaLibrary.js';

interface Project {
  id: string;
  name: string;
}

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects`)
      .then((r) => r.json())
      .then((json: { data?: Project[] }) => {
        const found = json.data?.find((p) => p.id === projectId) ?? null;
        setProject(found);
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-8 text-center text-gray-500">
        No project ID provided.{' '}
        <Link to="/" className="text-indigo-600 underline">Go home</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
        <MediaLibrary projectId={projectId} />
      </aside>

      {/* Main canvas area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-10 border-b border-gray-200 bg-white flex items-center px-4 gap-2">
          <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : project ? project.name : 'Unknown project'}
          </span>
        </div>

        {/* Canvas placeholder */}
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Timeline editor coming soon</p>
            <p className="text-gray-600 text-xs mt-1">Drag media from the sidebar to get started</p>
          </div>
        </div>

        {/* Timeline placeholder */}
        <div className="h-32 border-t border-gray-700 bg-gray-800 flex items-center justify-center">
          <p className="text-gray-500 text-xs">Timeline</p>
        </div>
      </main>
    </div>
  );
}
