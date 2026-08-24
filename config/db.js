import pg from 'pg';

// Centralized DB client with lazy connect and global caching so serverless
// environments reuse the client across invocations and avoid repeated
// connection churn / cold-start overhead.
export function getPgClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required but not set');
  }

  if (global.__pgClient) return global.__pgClient;

  // Keep TLS verification enabled by default. To disable, set DB_REJECT_UNAUTHORIZED=false
  const ssl = { rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED === 'false' ? false : true };

  const client = new pg.Client({ connectionString: databaseUrl });
  // mark connected flag; we'll set it after successful connect
  client._isConnected = false;
  global.__pgClient = client;
  return client;
}

export async function connectIfNeeded() {
  const client = getPgClient();
  if (client._isConnected) return client;
  await client.connect();
  client._isConnected = true;
  return client;
}
