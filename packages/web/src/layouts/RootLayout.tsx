import { Outlet, NavLink } from 'react-router-dom';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <span className="text-xl font-bold text-indigo-600">ClipFlow</span>
              <div className="flex gap-4">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/clips"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'
                    }`
                  }
                >
                  Clips
                </NavLink>
              </div>
            </div>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
