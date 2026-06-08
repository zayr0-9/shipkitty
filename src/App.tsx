import { FormEvent, useEffect, useState } from 'react';
import {
  appendMarkdownToGitHubRelease,
  fetchGitHubReleases,
  fetchGitHubRepos,
  getSession,
  logout,
  prepareImage,
  uploadImage,
  verifyGitHubRepo,
  type GitHubRelease,
  type GitHubRepo,
  type SessionUser,
  type UploadImageResponse,
} from './api';
import { CustomList } from './components/CustomList';
import { ImageCropEditor } from './components/ImageCropEditor';
import { compressImage, type CompressedImage, type ImageCrop } from './image';

type Status = 'idle' | 'compressing' | 'uploading' | 'done' | 'error';
type ReleaseAppendStatus = 'idle' | 'updating' | 'done' | 'error';

type PetOption = {
  id: string;
  name: string;
  title: string;
  emoji: string;
};

const repoPrivateLabel = {
  true: '🔒',
  false: '🌐',
} satisfies Record<string, string>;

const releaseStatusIcon = {
  draft: '📝',
  prerelease: '🧪',
  release: '🏷️',
} satisfies Record<string, string>;

const petOptions: PetOption[] = [
  { id: 'bobby', name: 'Bobby', title: 'Chief Purr Officer', emoji: '🐱' },
  { id: 'luna', name: 'Luna', title: 'Release Retriever', emoji: '🐶' },
  { id: 'lizzy', name: 'Lizzy', title: 'Launch Lizard', emoji: '🦎' },
  { id: 'pip', name: 'Pip', title: 'Deploy Penguin', emoji: '🐧' },
  { id: 'nibbles', name: 'Nibbles', title: 'Bug Bunny', emoji: '🐰' },
  { id: 'scout', name: 'Scout', title: 'Ship Fox', emoji: '🦊' },
  { id: 'milo', name: 'Milo', title: 'Merge Monkey', emoji: '🐵' },
  { id: 'kiwi', name: 'Kiwi', title: 'Release Parrot', emoji: '🦜' },
  { id: 'hazel', name: 'Hazel', title: 'Patch Hamster', emoji: '🐹' },
  { id: 'tango', name: 'Tango', title: 'Test Turtle', emoji: '🐢' },
  { id: 'ollie', name: 'Ollie', title: 'Ops Otter', emoji: '🦦' },
  { id: 'beau', name: 'Beau', title: 'Build Bear', emoji: '🐻' },
  { id: 'finn', name: 'Finn', title: 'Feature Fish', emoji: '🐠' },
  { id: 'dot', name: 'Dot', title: 'Debug Duck', emoji: '🦆' },
  { id: 'riley', name: 'Riley', title: 'Release Raccoon', emoji: '🦝' },
  { id: 'poppy', name: 'Poppy', title: 'Product Panda', emoji: '🐼' },
];

function getPetCaption(pet: PetOption) {
  return `Release approved by ${pet.name} ${pet.emoji}`;
}

const exampleMarkdown = `<!-- shipkitty:start -->\n### Release approved by Bobby 🐱\n\n<img\n    src="https://cdn.shipkitty.dev/r/karn/yggdrasil/v1.2.0/img_demo.webp"\n    alt="Bobby approved this release"\n    width="300"\n  />\n_Bobby, Chief Purr Officer_\n<!-- shipkitty:end -->`;

const inputClass = 'w-full min-w-0 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20';
const labelClass = 'flex min-w-0 flex-col gap-2 font-bold text-slate-700';
const cardClass = 'min-w-0 rounded-[1.5rem] border border-amber-200 bg-white/85 p-4 shadow-2xl shadow-amber-900/10 backdrop-blur sm:rounded-[1.75rem] sm:p-7';
const primaryButtonClass = 'inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-center font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonClass = 'inline-flex min-h-12 items-center justify-center rounded-full bg-amber-100 px-5 py-3 text-center font-extrabold text-amber-950 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60';

function App() {
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [releaseTag, setReleaseTag] = useState('');
  const [selectedPetId, setSelectedPetId] = useState(petOptions[0].id);
  const [petName, setPetName] = useState(petOptions[0].name);
  const [petTitle, setPetTitle] = useState(petOptions[0].title);
  const [caption, setCaption] = useState(getPetCaption(petOptions[0]));
  const [file, setFile] = useState<File | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [compressed, setCompressed] = useState<CompressedImage | null>(null);
  const [result, setResult] = useState<UploadImageResponse | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [repoStatus, setRepoStatus] = useState('Sign in to load repos or verify manual entries.');
  const [previewUrl, setPreviewUrl] = useState('');
  const [releaseAppendStatus, setReleaseAppendStatus] = useState<ReleaseAppendStatus>('idle');
  const [releaseAppendMessage, setReleaseAppendMessage] = useState('');
  const [releaseAppendUrl, setReleaseAppendUrl] = useState('');

  useEffect(() => {
    if (!compressed) {
      setPreviewUrl('');
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(compressed.blob);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [compressed]);

  useEffect(() => {
    getSession()
      .then((user) => {
        setSessionUser(user);
        setRepoStatus(user ? 'Load your GitHub repos or verify the manual repo.' : 'Sign in to load repos or verify manual entries.');
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load session.'))
      .finally(() => setAuthLoading(false));
  }, []);

  function handlePetChange(nextPetId: string) {
    const nextPet = petOptions.find((pet) => pet.id === nextPetId);
    if (!nextPet) return;

    setSelectedPetId(nextPet.id);
    setPetName(nextPet.name);
    setPetTitle(nextPet.title);
    setCaption(getPetCaption(nextPet));
  }

  async function handleFileChange(nextFile: File | undefined) {
    setFile(nextFile ?? null);
    setCompressed(null);
    setResult(null);
    setCopied(false);
    setMessage('');
    resetReleaseAppendState();

    if (!nextFile) return;

    setCropFile(nextFile);
    setStatus('idle');
    setMessage('Crop the image to a square before upload.');
  }

  async function handleCrop(crop: ImageCrop) {
    if (!cropFile) return;

    try {
      setStatus('compressing');
      const nextCompressed = await compressImage(cropFile, crop);
      setCompressed(nextCompressed);
      setCropFile(null);
      setStatus('idle');
      setMessage(`Compressed to ${formatBytes(nextCompressed.blob.size)} (${nextCompressed.width}×${nextCompressed.height}).`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Image compression failed.');
    }
  }

  function handleCropCancel() {
    setCropFile(null);
    setFile(null);
    setMessage('Image upload canceled.');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopied(false);
    setResult(null);
    resetReleaseAppendState();

    if (!sessionUser) {
      setStatus('error');
      setMessage('Sign in with GitHub before generating Markdown.');
      return;
    }

    if (!compressed || !file) {
      setStatus('error');
      setMessage('Choose an image before generating Markdown.');
      return;
    }

    try {
      setStatus('uploading');
      setMessage('Preparing upload...');
      const prepared = await prepareImage({
        owner,
        repo,
        releaseTag,
        petName,
        petTitle,
        caption,
        width: compressed.width,
        height: compressed.height,
      });

      setMessage('Uploading image to R2...');
      const uploaded = await uploadImage(prepared.uploadUrl, compressed.blob);
      setResult(uploaded);
      setStatus('done');
      setMessage('Done — copy this into your GitHub release notes or append it automatically.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  function resetReleaseAppendState() {
    setReleaseAppendStatus('idle');
    setReleaseAppendMessage('');
    setReleaseAppendUrl('');
  }

  async function handleAppendToRelease() {
    if (!result) return;

    try {
      setReleaseAppendStatus('updating');
      setReleaseAppendMessage('Updating GitHub release notes...');
      setReleaseAppendUrl('');
      const response = await appendMarkdownToGitHubRelease(result.imageId);
      setReleaseAppendStatus('done');
      setReleaseAppendUrl(response.release.htmlUrl);
      setReleaseAppendMessage(
        response.mode === 'replaced'
          ? 'Updated the existing ShipKitty block in the selected GitHub release.'
          : response.mode === 'unchanged'
            ? 'The selected GitHub release already has this ShipKitty block.'
            : 'Appended ShipKitty Markdown to the selected GitHub release.',
      );
    } catch (error) {
      setReleaseAppendStatus('error');
      setReleaseAppendMessage(error instanceof Error ? error.message : 'Could not update GitHub release notes.');
    }
  }

  async function copyMarkdown(markdown: string) {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setMessage('Markdown copied to clipboard.');
    } catch {
      setCopied(false);
      setStatus('error');
      setMessage('Could not copy Markdown. Select the snippet and copy it manually.');
    }
  }

  function handleLogin() {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    window.location.href = `${apiBaseUrl}/api/auth/github/start?redirect=${encodeURIComponent('/')}`;
  }

  async function handleLogout() {
    await logout();
    setSessionUser(null);
    setRepos([]);
    setReleases([]);
    resetReleaseAppendState();
    setRepoStatus('Signed out. Sign in to verify GitHub repo access.');
  }

  async function loadRepos() {
    try {
      setRepoStatus('Loading GitHub repos...');
      const nextRepos = await fetchGitHubRepos();
      setRepos(nextRepos);
      setSelectedRepoId('');
      setRepoStatus(nextRepos.length ? 'Choose a repo or keep typing manually.' : 'No accessible repos returned by GitHub.');
    } catch (error) {
      setRepoStatus(error instanceof Error ? error.message : 'Could not load repos.');
    }
  }

  async function handleRepoSelect(fullName: string) {
    if (!fullName) return;
    const selected = repos.find((item) => item.fullName === fullName);
    if (!selected) return;
    setSelectedRepoId(selected.fullName);
    setOwner(selected.owner);
    setRepo(selected.name);
    setReleases([]);
    resetReleaseAppendState();
    setRepoStatus(`Selected ${selected.fullName}. Loading releases...`);
    try {
      const nextReleases = await fetchGitHubReleases(selected.owner, selected.name);
      setReleases(nextReleases);
      setRepoStatus(nextReleases.length ? 'Choose a release tag or type one manually.' : 'Repo verified. No releases found; type a tag manually.');
    } catch (error) {
      setRepoStatus(error instanceof Error ? error.message : 'Could not load releases.');
    }
  }

  async function handleVerifyRepo() {
    try {
      setRepoStatus('Verifying GitHub repo access...');
      const verified = await verifyGitHubRepo(owner, repo);
      setSelectedRepoId(verified.fullName);
      setOwner(verified.owner);
      setRepo(verified.name);
      resetReleaseAppendState();
      const nextReleases = await fetchGitHubReleases(verified.owner, verified.name);
      setReleases(nextReleases);
      setRepoStatus(`Verified ${verified.fullName}. ${nextReleases.length ? 'Pick a release below.' : 'No releases found; type a tag manually.'}`);
    } catch (error) {
      setRepoStatus(error instanceof Error ? error.message : 'Could not verify repo.');
    }
  }

  const markdown = result?.markdown ?? exampleMarkdown;
  const statusClass = status === 'error' ? 'text-red-700' : status === 'done' ? 'text-emerald-700' : 'text-slate-500';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fffaf2] px-3 py-5 font-sans text-slate-800 sm:px-4 sm:py-8 md:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <section className="grid min-h-0 items-center gap-5 sm:gap-8 lg:min-h-[56vh] lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-700 sm:text-base">ShipKitty</p>
              {sessionUser ? (
                <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-extrabold text-slate-700 ring-1 ring-amber-200">
                  {sessionUser.avatarUrl && <img className="h-6 w-6 rounded-full" src={sessionUser.avatarUrl} alt="" />}
                  <span>@{sessionUser.githubUsername}</span>
                  <button className="text-amber-700 underline decoration-amber-300 underline-offset-4" type="button" onClick={handleLogout}>Logout</button>
                </div>
              ) : (
                <button className={secondaryButtonClass} type="button" onClick={handleLogin} disabled={authLoading}>
                  {authLoading ? 'Checking session...' : 'Sign in with GitHub'}
                </button>
              )}
            </div>
            <h1 className="max-w-3xl text-[2.65rem] font-black leading-[0.95] tracking-[-0.06em] text-slate-950 sm:text-7xl sm:tracking-[-0.08em] lg:text-8xl">
              Add a pet mascot to your GitHub release notes.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-xl sm:leading-8">
              Sign in with GitHub, verify access to a public or private repo, upload a compressed pet image,
              and copy a permanent Markdown snippet into your release notes.
            </p>
            <div className="mt-6 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
              <a href="#generator" className={primaryButtonClass}>Generate Markdown</a>
              <a href="#example" className={secondaryButtonClass}>See example</a>
            </div>
          </div>

          <div className={`${cardClass} w-full overflow-hidden`} id="example">
            <span className="font-extrabold uppercase tracking-[0.18em] text-amber-700">Example output</span>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner sm:rounded-3xl">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                Markdown preview
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="text-xl font-black text-slate-950">Release approved by Bobby 🐱</h3>
                <img
                  className="mt-4 aspect-square w-full rounded-2xl bg-amber-100 object-cover"
                  src="/bobby.jpg"
                  alt="Bobby approved this release"
                />
                <p className="mt-4 italic text-slate-600">Bobby, Chief Purr Officer</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]" id="generator">
          <form className={`${cardClass} flex flex-col gap-5`} onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
              <h2 className="text-xl font-black text-slate-950 sm:text-2xl">New release pet</h2>
              <CustomList
                label="Pet selector"
                ariaLabel="Choose a release pet"
                options={petOptions}
                selectedId={selectedPetId}
                onChange={handlePetChange}
                getId={(pet) => pet.id}
                getTitle={(pet) => pet.name}
                getSubtitle={(pet) => pet.title}
                getIcon={(pet) => pet.emoji}
                className="sm:ml-auto sm:w-72"
              />
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
                <button className={secondaryButtonClass} type="button" onClick={loadRepos} disabled={!sessionUser}>
                  Load my repos
                </button>
                <CustomList
                  label="Repo picker"
                  ariaLabel="Choose a GitHub repository"
                  options={repos}
                  selectedId={selectedRepoId}
                  onChange={handleRepoSelect}
                  getId={(item) => item.fullName}
                  getTitle={(item) => item.fullName}
                  getSubtitle={(item) => `${item.private ? 'Private' : 'Public'}${item.permission ? ` · ${item.permission}` : ''}`}
                  getIcon={(item) => repoPrivateLabel[String(item.private) as keyof typeof repoPrivateLabel]}
                  placeholderTitle="Choose from GitHub..."
                  placeholderSubtitle={repos.length ? 'Select a loaded repository' : 'Load repos to choose one'}
                  placeholderIcon="📦"
                  disabled={!repos.length}
                  className="flex-1"
                />
              </div>
              <p className="mt-3 text-sm font-bold text-amber-900">{repoStatus}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className={labelClass}>
                GitHub owner
                <input className={inputClass} value={owner} onChange={(event) => { setOwner(event.target.value); setSelectedRepoId(''); resetReleaseAppendState(); }} required pattern="[A-Za-z0-9_.\\-]+" />
              </label>
              <label className={labelClass}>
                Repo name
                <input className={inputClass} value={repo} onChange={(event) => { setRepo(event.target.value); setSelectedRepoId(''); resetReleaseAppendState(); }} required pattern="[A-Za-z0-9_.\\-]+" />
              </label>
              <button className={secondaryButtonClass} type="button" onClick={handleVerifyRepo} disabled={!sessionUser}>
                Verify repo
              </button>
            </div>

            <label className={labelClass}>
              Release tag
              <input className={inputClass} value={releaseTag} onChange={(event) => { setReleaseTag(event.target.value); resetReleaseAppendState(); }} required placeholder="v1.2.0" />
            </label>

            {releases.length > 0 && (
              <CustomList
                label="Release picker"
                ariaLabel="Choose a GitHub release"
                options={releases}
                selectedId={releaseTag}
                onChange={(tagName) => { setReleaseTag(tagName); resetReleaseAppendState(); }}
                getId={(release) => release.tagName}
                getTitle={(release) => release.tagName}
                getSubtitle={(release) => [release.name, release.draft ? 'draft' : release.prerelease ? 'prerelease' : 'release'].filter(Boolean).join(' · ')}
                getIcon={(release) => releaseStatusIcon[release.draft ? 'draft' : release.prerelease ? 'prerelease' : 'release']}
                placeholderTitle="Choose a GitHub release..."
                placeholderSubtitle="Select a loaded release or type a tag manually"
                placeholderIcon="🏷️"
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Pet name
                <input className={inputClass} value={petName} onChange={(event) => setPetName(event.target.value)} required maxLength={80} />
              </label>
              <label className={labelClass}>
                Pet title
                <input className={inputClass} value={petTitle} onChange={(event) => setPetTitle(event.target.value)} maxLength={120} />
              </label>
            </div>

            <label className={labelClass}>
              Caption
              <input className={inputClass} value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={160} />
            </label>

            <div className="flex flex-col gap-2 font-bold text-slate-700">
              <span>Upload pet image</span>
              <label className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-3 transition hover:-translate-y-0.5 hover:border-amber-500 hover:bg-amber-100 focus-within:ring-4 focus-within:ring-amber-500/20 sm:flex-row sm:items-center">
                <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFileChange(event.target.files?.[0])} />
                <span className="rounded-full bg-slate-950 px-4 py-3 text-center font-extrabold text-white sm:shrink-0">Choose pet image</span>
                <span className="min-w-0 break-words font-bold text-amber-950 sm:truncate">{file?.name || 'PNG, JPEG, or WebP'}</span>
              </label>
            </div>

            <p className={`min-h-6 ${statusClass}`}>{message || 'Images are cropped square and resized client-side to WebP under 50 KB.'}</p>

            <button className={`${primaryButtonClass} w-full sm:w-auto`} type="submit" disabled={!sessionUser || status === 'compressing' || status === 'uploading'}>
              {!sessionUser ? 'Sign in first' : status === 'uploading' ? 'Uploading...' : 'Generate Markdown'}
            </button>
          </form>

          <aside className={`${cardClass} flex flex-col gap-4 sm:gap-5`}>
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">Preview</h2>
            {cropFile ? (
              <ImageCropEditor file={cropFile} onCancel={handleCropCancel} onApply={handleCrop} />
            ) : previewUrl ? (
              <img className="aspect-square w-full rounded-3xl bg-amber-100 object-cover" src={previewUrl} alt="Compressed pet preview" />
            ) : (
              <div className="grid min-h-56 place-items-center rounded-2xl border-2 border-dashed border-amber-200 p-4 text-center font-bold text-amber-800 sm:min-h-80 sm:rounded-3xl">
                Choose an image to preview the compressed WebP.
              </div>
            )}
            {compressed && !cropFile && <p className="text-slate-600">{formatBytes(compressed.blob.size)} · {compressed.width}×{compressed.height}</p>}
            {result && <a className="font-extrabold text-amber-700 underline decoration-amber-300 underline-offset-4" href={result.publicUrl} target="_blank" rel="noreferrer">Open public image</a>}
          </aside>
        </section>

        <section className={`${cardClass} mt-5 flex flex-col gap-4 sm:mt-6 sm:gap-5`}>
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">GitHub Markdown</h2>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {result && (
                <button className={primaryButtonClass} onClick={handleAppendToRelease} type="button" disabled={releaseAppendStatus === 'updating'}>
                  {releaseAppendStatus === 'updating' ? 'Updating release...' : 'Append to GitHub release'}
                </button>
              )}
              <button className={secondaryButtonClass} onClick={() => copyMarkdown(markdown)} type="button">
                {copied ? 'Copied!' : 'Copy Markdown'}
              </button>
            </div>
          </div>
          {releaseAppendMessage && (
            <p className={releaseAppendStatus === 'error' ? 'font-bold text-red-700' : 'font-bold text-emerald-700'}>
              {releaseAppendMessage}
              {releaseAppendUrl && (
                <>
                  {' '}
                  <a className="underline decoration-emerald-300 underline-offset-4" href={releaseAppendUrl} target="_blank" rel="noreferrer">Open GitHub release</a>
                </>
              )}
            </p>
          )}
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-50 sm:break-words sm:rounded-3xl sm:p-5 sm:text-sm sm:leading-6">{markdown}</pre>
          {result?.html && (
            <details className="font-bold text-slate-800">
              <summary className="cursor-pointer">Compact HTML version</summary>
              <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-50 sm:break-words sm:rounded-3xl sm:p-5 sm:text-sm sm:leading-6">{result.html}</pre>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default App;
