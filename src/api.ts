const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export type PrepareImageRequest = {
  owner: string;
  repo: string;
  releaseTag: string;
  petName: string;
  petTitle?: string;
  caption?: string;
  width?: number;
  height?: number;
};

export type PrepareImageResponse = {
  imageId: string;
  uploadUrl: string;
  maxBytes: number;
  allowedTypes: string[];
};

export type UploadImageResponse = {
  imageId: string;
  publicUrl: string;
  markdown: string;
  html: string;
};

export type SessionUser = {
  id: string;
  githubUserId: string;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  scopes: string[];
};

export type GitHubRepo = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  permission: string | null;
};

export type GitHubRelease = {
  id: number;
  tagName: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  htmlUrl: string;
  publishedAt: string | null;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function getSession(): Promise<SessionUser | null> {
  const response = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
  const data = await parseApiResponse<{ user?: SessionUser | null } | null>(response);
  return data?.user ?? null;
}

export async function logout(): Promise<void> {
  const response = await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
  await parseApiResponse<{ ok: true }>(response);
}

export async function fetchGitHubRepos(): Promise<GitHubRepo[]> {
  const response = await fetch(apiUrl('/api/github/repos'), { credentials: 'include' });
  const data = await parseApiResponse<{ repos: GitHubRepo[] }>(response);
  return data.repos;
}

export async function verifyGitHubRepo(owner: string, repo: string): Promise<GitHubRepo> {
  const response = await fetch(apiUrl(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/verify`), { credentials: 'include' });
  const data = await parseApiResponse<{ ok: true; repo: GitHubRepo }>(response);
  return data.repo;
}

export async function fetchGitHubReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
  const response = await fetch(apiUrl(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`), { credentials: 'include' });
  const data = await parseApiResponse<{ releases: GitHubRelease[] }>(response);
  return data.releases;
}

export async function prepareImage(payload: PrepareImageRequest): Promise<PrepareImageResponse> {
  const response = await fetch(apiUrl('/api/images/prepare'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<PrepareImageResponse>(response);
}

export async function uploadImage(uploadUrl: string, file: Blob): Promise<UploadImageResponse> {
  const response = await fetch(apiUrl(uploadUrl), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': file.type || 'image/webp' },
    body: file,
  });

  return parseApiResponse<UploadImageResponse>(response);
}

export async function fetchMarkdown(owner: string, repo: string, tag: string): Promise<UploadImageResponse | null> {
  const params = new URLSearchParams({ owner, repo, tag });
  const response = await fetch(apiUrl(`/api/markdown?${params.toString()}`));

  if (response.status === 404) {
    return null;
  }

  return parseApiResponse<UploadImageResponse>(response);
}
