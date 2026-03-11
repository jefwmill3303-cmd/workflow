import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Clip, CreateClipDto, UpdateClipDto, ApiResponse, PaginatedResponse } from '@clipflow/shared';

export const clipsRouter = Router();

// In-memory store for demonstration
const clips: Clip[] = [];

clipsRouter.get('/', (_req: Request, res: Response) => {
  const response: PaginatedResponse<Clip> = {
    data: clips,
    total: clips.length,
    page: 1,
    pageSize: 20,
    totalPages: Math.ceil(clips.length / 20),
  };
  res.json(response);
});

clipsRouter.get('/:id', (req: Request, res: Response) => {
  const clip = clips.find((c) => c.id === req.params['id']);
  if (!clip) {
    res.status(404).json({ success: false, message: 'Clip not found' });
    return;
  }
  const response: ApiResponse<Clip> = { data: clip, success: true };
  res.json(response);
});

clipsRouter.post('/', (req: Request, res: Response) => {
  const dto = req.body as CreateClipDto;
  const clip: Clip = {
    id: crypto.randomUUID(),
    title: dto.title,
    description: dto.description,
    url: dto.url,
    status: 'draft',
    tags: dto.tags ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'anonymous',
  };
  clips.push(clip);
  const response: ApiResponse<Clip> = { data: clip, success: true, message: 'Clip created' };
  res.status(201).json(response);
});

clipsRouter.patch('/:id', (req: Request, res: Response) => {
  const index = clips.findIndex((c) => c.id === req.params['id']);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'Clip not found' });
    return;
  }
  const dto = req.body as UpdateClipDto;
  const existing = clips[index]!;
  clips[index] = { ...existing, ...dto, updatedAt: new Date().toISOString() };
  const response: ApiResponse<Clip> = { data: clips[index]!, success: true };
  res.json(response);
});

clipsRouter.delete('/:id', (req: Request, res: Response) => {
  const index = clips.findIndex((c) => c.id === req.params['id']);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'Clip not found' });
    return;
  }
  clips.splice(index, 1);
  res.status(204).send();
});
