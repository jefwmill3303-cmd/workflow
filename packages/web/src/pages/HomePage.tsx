import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
        Welcome to <span className="text-indigo-600">ClipFlow</span>
      </h1>
      <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl">
        Manage and share your video clips with ease. Organize, tag, and publish your content all in
        one place.
      </p>
      <div className="mt-10">
        <Link
          to="/clips"
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          View Clips
        </Link>
      </div>
    </div>
  );
}
