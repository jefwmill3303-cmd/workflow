import { Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './pages/HomePage';
import { ClipsPage } from './pages/ClipsPage';
import { EditorPage } from './pages/EditorPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="editor/:projectId" element={<EditorPage />} />
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="clips" element={<ClipsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
