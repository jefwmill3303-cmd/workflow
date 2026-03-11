import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'video/mp4': 'VIDEO',
  'video/quicktime': 'VIDEO',
  'video/webm': 'VIDEO',
  'audio/mpeg': 'AUDIO',
  'audio/wav': 'AUDIO',
  'audio/wave': 'AUDIO',
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

export const mediaRouter = Router();

// POST /api/media/upload
mediaRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { projectId } = req.body as { projectId?: string };

    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided' });
      return;
    }

    if (!projectId) {
      res.status(400).json({ success: false, message: 'projectId is required' });
      return;
    }

    const mediaType = ALLOWED_MIME_TYPES[file.mimetype];
    const fileUrl = `/uploads/${file.filename}`;

    const mediaFile = await prisma.mediaFile.create({
      data: {
        project_id: projectId,
        type: mediaType as 'VIDEO' | 'AUDIO' | 'IMAGE',
        filename: file.originalname,
        url: fileUrl,
        metadata: {
          mimetype: file.mimetype,
          size: file.size,
          storedFilename: file.filename,
        },
      },
    });

    res.status(201).json({ success: true, data: mediaFile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/media/:projectId
mediaRouter.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params['projectId'] as string;

    const mediaFiles = await prisma.mediaFile.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: mediaFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch media files';
    res.status(500).json({ success: false, message });
  }
});
