import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clipsRouter } from './routes/clips.js';
import { healthRouter } from './routes/health.js';
import { projectsRouter } from './routes/projects.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/clips', clipsRouter);
app.use('/api/projects', projectsRouter);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
