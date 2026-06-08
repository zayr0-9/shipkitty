export type Env = {
  DB: D1Database;
  PET_IMAGES: R2Bucket;
  PUBLIC_CDN_BASE?: string;
  APP_BASE_URL?: string;
  FRONTEND_BASE_URL?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

export type PreparedImageMetadata = {
  id: string;
  repoId: string;
  petId: string;
  owner: string;
  repo: string;
  releaseTag: string;
  petName: string;
  petTitle: string;
  caption: string;
  width: number | null;
  height: number | null;
  r2Key: string;
  publicUrl: string;
  markdown: string;
  html: string;
  createdAt: string;
  userId?: string;
};
