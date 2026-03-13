import { Queue } from 'bullmq';

export interface ExportJobData {
  exportId: string;
  projectId: string;
  platform: string;
  settings: Record<string, unknown>;
  projectState: Record<string, unknown>;
}

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// In-memory fallback queue when Redis is unavailable
export const inMemoryQueue: ExportJobData[] = [];

let exportQueue: Queue<ExportJobData> | null = null;
let queueFailed = false;

function getConnectionOpts() {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
      lazyConnect: true,
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null as null, enableReadyCheck: false, lazyConnect: true };
  }
}

export function getExportQueue(): Queue<ExportJobData> | null {
  if (queueFailed) return null;
  if (exportQueue) return exportQueue;
  try {
    exportQueue = new Queue<ExportJobData>('exports', { connection: getConnectionOpts() });
    return exportQueue;
  } catch {
    queueFailed = true;
    return null;
  }
}

export async function enqueueExport(data: ExportJobData): Promise<void> {
  const queue = getExportQueue();
  if (queue) {
    try {
      await queue.add('export', data, { jobId: data.exportId });
      return;
    } catch {
      // Fall through to in-memory
    }
  }
  // In-memory fallback
  inMemoryQueue.push(data);
}
