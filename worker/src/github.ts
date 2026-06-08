import { randomToken, sha256Base64Url } from './auth';
import type { Env } from './types';

const GITHUB_WEB = 'https://github.com';
const GITHUB_API = 'https://api.github.com';
const OAUTH_SCOPE = 'repo';

export type OAuthStart = {
  authorizeUrl: string;
  state: string;
  codeVerifier: string;
};

export type GitHubTokenResponse = {
  access_token: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type GitHubUser = {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string | null;
};

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
  owner: { login: string };
};

export type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string | null;
};

export async function createOAuthStart(env: Env, request: Request, redirectPath = '/') {
  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const callbackUrl = `${getAppBaseUrl(env, request)}/api/auth/github/callback`;
  const authorizeUrl = new URL('/login/oauth/authorize', GITHUB_WEB);

  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
  authorizeUrl.searchParams.set('scope', OAUTH_SCOPE);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  return { authorizeUrl: authorizeUrl.toString(), state, codeVerifier, redirectPath };
}

export async function exchangeOAuthCode(env: Env, request: Request, code: string, codeVerifier: string) {
  const response = await fetch(`${GITHUB_WEB}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'PetShip OAuth Worker',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${getAppBaseUrl(env, request)}/api/auth/github/callback`,
      code_verifier: codeVerifier,
    }),
  });

  const data = (await response.json()) as GitHubTokenResponse;
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub OAuth token exchange failed.');
  }
  return data;
}

export async function fetchGitHubUser(accessToken: string) {
  return githubRequest<GitHubUser>('/user', accessToken);
}

export async function fetchUserRepos(accessToken: string) {
  const repos = await githubRequest<GitHubRepo[]>('/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100', accessToken);
  return repos.map(toRepoSummary);
}

export async function fetchRepo(accessToken: string, owner: string, repo: string) {
  const data = await githubRequest<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, accessToken);
  return { raw: data, summary: toRepoSummary(data) };
}

export async function fetchReleases(accessToken: string, owner: string, repo: string) {
  const releases = await githubRequest<GitHubRelease[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100`, accessToken);
  return releases.map(toReleaseSummary);
}

export async function fetchReleaseByTag(accessToken: string, owner: string, repo: string, tag: string) {
  const release = await githubRequest<GitHubRelease>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`, accessToken);
  return release;
}

export async function updateReleaseBody(accessToken: string, owner: string, repo: string, releaseId: number, body: string) {
  const release = await githubRequest<GitHubRelease>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}`, accessToken, {
    method: 'PATCH',
    body: { body },
  });
  return release;
}

type GitHubRequestOptions = {
  method?: 'GET' | 'PATCH';
  body?: unknown;
};

async function githubRequest<T>(path: string, accessToken: string, options: GitHubRequestOptions = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'PetShip OAuth Worker',
      'x-github-api-version': '2022-11-28',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('GitHub session expired. Sign in again.');
    if (response.status === 403) throw new Error('GitHub access denied for this repository.');
    if (response.status === 404) throw new Error('GitHub repository or release was not found.');
    throw new Error(`GitHub API request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export function toReleaseSummary(release: GitHubRelease) {
  return {
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    draft: release.draft,
    prerelease: release.prerelease,
    htmlUrl: release.html_url,
    publishedAt: release.published_at,
  };
}

function toRepoSummary(repo: GitHubRepo) {
  return {
    id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    permission: getPermission(repo),
  };
}

function getPermission(repo: GitHubRepo) {
  const permissions = repo.permissions;
  if (!permissions) return null;
  if (permissions.admin) return 'admin';
  if (permissions.maintain) return 'maintain';
  if (permissions.push) return 'push';
  if (permissions.triage) return 'triage';
  if (permissions.pull) return 'pull';
  return null;
}

function getAppBaseUrl(env: Env, request: Request) {
  return (env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
}
