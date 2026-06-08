export type Env = {
  DB: D1Database;
  PET_IMAGES: R2Bucket;
  PUBLIC_CDN_BASE?: string;
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
};
