import { Worker } from 'bullmq';
import { prisma } from '../lib/db.js';
import { getWorkerConnectionOpts } from '../lib/workerConnection.js';
import { inMemoryQueue, type ExportJobData } from '../lib/queue.js';

const STEP_INTERVAL_MS = 1_500; // tick every 1.5s
const STEP_PERCENT = 5;         // 5% per tick

async function runMockExport(exportId: string): Promise<void> {
  let progress = 0;

  await prisma.export.update({
    where: { id: exportId },
    data: { status: 'processing', progress: 0 },
  });

  return new Promise((resolve) => {
    const tick = async () => {
      progress = Math.min(100, progress + STEP_PERCENT);

      if (progress >= 100) {
        await prisma.export.update({
          where: { id: exportId },
          data: {
            status: 'complete',
            progress: 100,
            output_url: `/exports/${exportId}/output.mp4`,
          },
        });
        resolve();
      } else {
        await prisma.export.update({
          where: { id: exportId },
          data: { progress },
        });
        setTimeout(() => void tick(), STEP_INTERVAL_MS);
      }
    };
    setTimeout(() => void tick(), STEP_INTERVAL_MS);
  });
}

// Process in-memory queue (Redis fallback)
async function drainInMemoryQueue(): Promise<void> {
  while (inMemoryQueue.length > 0) {
    const job = inMemoryQueue.shift();
    if (job) {
      try {
        await runMockExport(job.exportId);
      } catch (err) {
        await prisma.export.update({
          where: { id: job.exportId },
          data: { status: 'failed', error: String(err) },
        });
      }
    }
  }
}

let worker: Worker | null = null;
let inMemoryPollInterval: ReturnType<typeof setInterval> | null = null;

export function startExportWorker(): void {
  try {
    worker = new Worker(
      'exports',
      async (job) => {
        const data = job.data as ExportJobData;
        await runMockExport(data.exportId);
      },
      { connection: getWorkerConnectionOpts(), concurrency: 3 },
    );

    worker.on('failed', async (job, err) => {
      if (!job) return;
      const data = job.data as ExportJobData;
      await prisma.export.update({
        where: { id: data.exportId },
        data: { status: 'failed', error: err.message },
      });
    });

    console.log('Export worker started (BullMQ/Redis)');
    return;
  } catch {
    // Fall through to in-memory poll
  }

  // Fallback: poll the in-memory queue every 500ms
  inMemoryPollInterval = setInterval(() => {
    void drainInMemoryQueue();
  }, 500);

  console.log('Export worker started (in-memory fallback)');
}

export function stopExportWorker(): void {
  if (worker) {
    void worker.close();
    worker = null;
  }
  if (inMemoryPollInterval) {
    clearInterval(inMemoryPollInterval);
    inMemoryPollInterval = null;
  }
}
