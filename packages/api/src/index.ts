import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { clipsRouter } from './routes/clips.js';
import { healthRouter } from './routes/health.js';
import { projectsRouter } from './routes/projects.js';
import { mediaRouter } from './routes/media.js';
import { exportRouter } from './routes/export.js';
import { startExportWorker } from './workers/exportWorker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/health', healthRouter);
app.use('/api/clips', clipsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/exports', exportRouter);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  startExportWorker();
});
