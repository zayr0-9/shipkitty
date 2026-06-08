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

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function prepareImage(payload: PrepareImageRequest): Promise<PrepareImageResponse> {
  const response = await fetch('/api/images/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<PrepareImageResponse>(response);
}

export async function uploadImage(uploadUrl: string, file: Blob): Promise<UploadImageResponse> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'image/webp' },
    body: file,
  });

  return parseApiResponse<UploadImageResponse>(response);
}

export async function fetchMarkdown(owner: string, repo: string, tag: string): Promise<UploadImageResponse | null> {
  const params = new URLSearchParams({ owner, repo, tag });
  const response = await fetch(`/api/markdown?${params.toString()}`);

  if (response.status === 404) {
    return null;
  }

  return parseApiResponse<UploadImageResponse>(response);
}
