import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { enqueueExport } from '../lib/queue.js';

export const exportRouter = Router();

// POST /api/exports — create + enqueue one export job
exportRouter.post('/', async (req, res) => {
  const { projectId, platform, settings, projectState } = req.body as {
    projectId: string;
    platform: string;
    settings: Record<string, unknown>;
    projectState: Record<string, unknown>;
  };

  if (!projectId || !platform) {
    res.status(400).json({ error: 'projectId and platform are required' });
    return;
  }

  try {
    const exportRecord = await prisma.export.create({
      data: {
        project_id: projectId,
        platform,
        status: 'queued',
        progress: 0,
        settings: { ...settings, projectState } as object,
      },
    });

    await enqueueExport({
      exportId: exportRecord.id,
      projectId,
      platform,
      settings: settings ?? {},
      projectState: projectState ?? {},
    });

    res.status(201).json({ data: exportRecord });
  } catch (err) {
    console.error('Export create error:', err);
    res.status(500).json({ error: 'Failed to create export' });
  }
});

// GET /api/exports/:id — poll status
exportRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const exportRecord = await prisma.export.findUnique({ where: { id } });
    if (!exportRecord) {
      res.status(404).json({ error: 'Export not found' });
      return;
    }
    res.json({ data: exportRecord });
  } catch (err) {
    console.error('Export fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch export' });
  }
});

// GET /api/exports/project/:projectId — list exports for a project
exportRouter.get('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const exports = await prisma.export.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: exports });
  } catch (err) {
    console.error('Export list error:', err);
    res.status(500).json({ error: 'Failed to list exports' });
  }
});
