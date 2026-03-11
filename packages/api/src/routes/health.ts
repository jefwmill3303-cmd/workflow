import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(503).json({ status: 'error', db: 'disconnected', error: message, timestamp: new Date().toISOString() });
  }
});
