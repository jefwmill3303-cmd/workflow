const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

export function getWorkerConnectionOpts() {
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
