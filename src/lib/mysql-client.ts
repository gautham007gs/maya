let mysqlModule: any = null;
let pool: any = null;
let poolInitPromise: Promise<any> | null = null;

let poolErrorCount = 0;
const POOL_RESET_THRESHOLD = 5;
// When a remote MySQL server is unreachable, let the first connection attempt
// establish that fact and briefly fail fast afterwards. Without this breaker,
// every mounted provider/analytics request starts another TCP timeout, turning
// one outage into a page-wide 8–15 second stall and a flood of identical logs.
let unavailableUntil = 0;
const DATABASE_RETRY_DELAY_MS = 5_000;

/**
 * No query on this pool may run longer than this. Without a bound, a single
 * slow/stuck query (lock wait, network stall, DB overload) hangs the SSR
 * request indefinitely — this is what a synthetic tool like Lighthouse
 * reports as PAGE_HUNG, and what a real user experiences as a page that
 * never finishes loading. connectTimeout only bounds the initial TCP
 * handshake; it does nothing once a connection is established and a query
 * is in flight, so we bound that here too.
 *
 * NOTE: this races the JS promise against a timer — it does not cancel the
 * query server-side. A timed-out query keeps running in MySQL until it
 * finishes naturally; the connection returns to the pool once it does. That
 * is an acceptable trade-off (matches the same "never block the app longer
 * than X ms on a dependency" policy already applied to Redis) — a page that
 * fails fast and falls back to an empty/cached result is far better than one
 * that hangs the whole request.
 */
const DEFAULT_QUERY_TIMEOUT_MS = 8_000;

function wrapPoolWithQueryTimeout(rawPool: any, timeoutMs: number): any {
  const originalQuery = rawPool.query.bind(rawPool);
  const originalExecute = typeof rawPool.execute === 'function' ? rawPool.execute.bind(rawPool) : null;
  const withTimeout = (fn: (...a: any[]) => Promise<any>) => (...args: any[]) =>
    Promise.race([
      fn(...args),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`MySQL query timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  const timedQuery = withTimeout(originalQuery);
  const timedExecute = originalExecute ? withTimeout(originalExecute) : null;

  return new Proxy(rawPool, {
    get(target, prop, receiver) {
      if (prop === 'query') return timedQuery;
      if (prop === 'execute' && timedExecute) return timedExecute;
      const value = Reflect.get(target, prop, receiver);
      // Preserve `this` binding to the real pool for every other method
      // (getConnection, end, on, ...) — returning them unbound through the
      // proxy would call them with `this` = the proxy object, which breaks
      // mysql2's internal implementation.
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function resetPool(): Promise<void> {
  if (pool) {
    try { await pool.end(); } catch { /* ignore */ }
    pool = null;
  }
  poolInitPromise = null;
  poolErrorCount = 0;
}

async function createPool(): Promise<any> {
  if (!mysqlModule) {
    const mysql = await import('mysql2/promise');
    mysqlModule = mysql;
  }
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;

  if (!host || !user || !database) {
    throw new Error(
      'Missing MySQL environment variables. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.'
    );
  }

  const connectionLimit = Number(process.env.MYSQL_CONNECTION_LIMIT || 10);

  const newPool = mysqlModule.createPool({
    host,
    user,
    password,
    database,
    port,
    connectionLimit: Math.max(6, Math.min(20, connectionLimit)),
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    waitForConnections: true,
    queueLimit: 50,
  });

  newPool.on('error', () => { poolErrorCount++; });
  return wrapPoolWithQueryTimeout(newPool, DEFAULT_QUERY_TIMEOUT_MS);
}

export const getMysqlClient = async () => {
  if (typeof window !== 'undefined') {
    throw new Error('getMysqlClient must only be called on the server side.');
  }

  if (Date.now() < unavailableUntil) {
    throw new Error('MySQL temporarily unavailable');
  }

  if (pool && poolErrorCount >= POOL_RESET_THRESHOLD) {
    await resetPool();
  }

  if (pool) return pool;

  if (!poolInitPromise) {
    poolInitPromise = createPool()
      .then(p => {
        pool = p;
        return p;
      })
      .catch(err => {
        poolInitPromise = null;
        unavailableUntil = Date.now() + DATABASE_RETRY_DELAY_MS;
        throw err;
      });
  }

  return poolInitPromise;
};

export const testMysqlConnection = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    const client = await getMysqlClient();
    await client.query('SELECT 1');
    poolErrorCount = 0;
    return { ok: true };
  } catch (err: any) {
    poolErrorCount++;
    return { ok: false, error: err.message };
  }
};
