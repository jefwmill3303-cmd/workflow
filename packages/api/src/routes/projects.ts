import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/db.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({ orderBy: { created_at: 'desc' } });
    res.json({ data: projects, total: projects.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

projectsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const { name, timeline_data, settings } = req.body as {
      name?: string;
      timeline_data?: object;
      settings?: object;
    };

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(timeline_data !== undefined ? { timeline_data: timeline_data as object } : {}),
        ...(settings !== undefined ? { settings: settings as object } : {}),
      },
    });

    res.json({ data: project });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

projectsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, timeline_data, settings } = req.body as {
      name: string;
      timeline_data?: unknown;
      settings?: unknown;
    };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name,
        timeline_data: timeline_data ?? {},
        settings: settings ?? {},
      },
    });

    res.status(201).json({ data: project });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
