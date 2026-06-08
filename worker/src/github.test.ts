import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReleaseByTag, updateReleaseBody } from './github';

const release = {
  id: 123,
  tag_name: 'v1.0.0',
  name: 'v1.0.0',
  body: 'notes',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
  published_at: '2026-06-08T00:00:00Z',
};

describe('github release helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a release by tag with encoded path segments', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(release), { status: 200 }));

    await fetchReleaseByTag('token', 'space owner', 'repo/name', 'v1.0.0 beta');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/space%20owner/repo%2Fname/releases/tags/v1.0.0%20beta',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('patches release body with GitHub JSON headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(release), { status: 200 }));

    await updateReleaseBody('token', 'owner', 'repo', 123, 'new body');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/releases/123',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ body: 'new body' }),
        headers: expect.objectContaining({
          accept: 'application/vnd.github+json',
          authorization: 'Bearer token',
          'content-type': 'application/json',
          'x-github-api-version': '2022-11-28',
        }),
      }),
    );
  });
});
