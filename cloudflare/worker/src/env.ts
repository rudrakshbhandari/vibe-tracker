export type VibeWorkerEnv = {
  DB: D1Database;
  APP_URL?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_SLUG?: string;
  INTERNAL_API_TOKEN?: string;
  MAINTENANCE_TOKEN?: string;
  SESSION_ENCRYPTION_KEY?: string;
  SYNC_QUEUE?: Queue<unknown>;
};
