import { FormEvent, useMemo, useState } from 'react';
import { prepareImage, uploadImage, type UploadImageResponse } from './api';
import { compressImage, type CompressedImage } from './image';

type Status = 'idle' | 'compressing' | 'uploading' | 'done' | 'error';

type PetOption = {
  id: string;
  name: string;
  title: string;
  emoji: string;
};

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

const exampleMarkdown = `<!-- petship:start -->\n### Release approved by Bobby 🐱\n\n![Bobby approved this release](https://cdn.petship.dev/r/karn/yggdrasil/v1.2.0/img_demo.webp)\n\n_Bobby, Chief Purr Officer_\n<!-- petship:end -->`;

const inputClass = 'w-full min-w-0 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20';
const labelClass = 'flex min-w-0 flex-col gap-2 font-bold text-slate-700';
const cardClass = 'min-w-0 rounded-[1.5rem] border border-amber-200 bg-white/85 p-4 shadow-2xl shadow-amber-900/10 backdrop-blur sm:rounded-[1.75rem] sm:p-7';
const primaryButtonClass = 'inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-center font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonClass = 'inline-flex min-h-12 items-center justify-center rounded-full bg-amber-100 px-5 py-3 text-center font-extrabold text-amber-950 transition hover:-translate-y-0.5 hover:bg-amber-200';

function App() {
  const [owner, setOwner] = useState('karn');
  const [repo, setRepo] = useState('yggdrasil');
  const [releaseTag, setReleaseTag] = useState('v1.2.0');
  const [selectedPetId, setSelectedPetId] = useState(petOptions[0].id);
  const [petName, setPetName] = useState(petOptions[0].name);
  const [petTitle, setPetTitle] = useState(petOptions[0].title);
  const [caption, setCaption] = useState(getPetCaption(petOptions[0]));
  const [file, setFile] = useState<File | null>(null);
  const [compressed, setCompressed] = useState<CompressedImage | null>(null);
  const [result, setResult] = useState<UploadImageResponse | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPetMenuOpen, setIsPetMenuOpen] = useState(false);

  const selectedPet = useMemo(
    () => petOptions.find((pet) => pet.id === selectedPetId) ?? petOptions[0],
    [selectedPetId],
  );

  const previewUrl = useMemo(() => {
    if (!compressed) return '';
    return URL.createObjectURL(compressed.blob);
  }, [compressed]);

  function handlePetChange(nextPetId: string) {
    const nextPet = petOptions.find((pet) => pet.id === nextPetId);
    if (!nextPet) return;

    setSelectedPetId(nextPet.id);
    setPetName(nextPet.name);
    setPetTitle(nextPet.title);
    setCaption(getPetCaption(nextPet));
    setIsPetMenuOpen(false);
  }

  async function handleFileChange(nextFile: File | undefined) {
    setFile(nextFile ?? null);
    setCompressed(null);
    setResult(null);
    setCopied(false);
    setMessage('');

    if (!nextFile) return;

    try {
      setStatus('compressing');
      const nextCompressed = await compressImage(nextFile);
      setCompressed(nextCompressed);
      setStatus('idle');
      setMessage(`Compressed to ${formatBytes(nextCompressed.blob.size)} (${nextCompressed.width}×${nextCompressed.height}).`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Image compression failed.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopied(false);
    setResult(null);

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
      setMessage('Done — copy this into your GitHub release notes.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  async function copyMarkdown(markdown: string) {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
  }

  const markdown = result?.markdown ?? exampleMarkdown;
  const statusClass = status === 'error' ? 'text-red-700' : status === 'done' ? 'text-emerald-700' : 'text-slate-500';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fffaf2] px-3 py-5 font-sans text-slate-800 sm:px-4 sm:py-8 md:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <section className="grid min-h-0 items-center gap-5 sm:gap-8 lg:min-h-[56vh] lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-amber-700 sm:mb-4 sm:text-base">PetShip MVP</p>
            <h1 className="max-w-3xl text-[2.65rem] font-black leading-[0.95] tracking-[-0.06em] text-slate-950 sm:text-7xl sm:tracking-[-0.08em] lg:text-8xl">
              Add a pet mascot to your GitHub release notes.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-xl sm:leading-8">
              Upload a compressed pet or mascot image, link it to a repo release, and copy a permanent
              Markdown snippet. No GitHub OAuth needed for stage 1.
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
              <div className="relative flex min-w-0 flex-col gap-2 font-bold text-slate-700 sm:ml-auto sm:w-72">
                <span>Pet selector</span>
                <button
                  className="group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 px-3 py-2 text-left shadow-inner shadow-amber-900/5 outline-none transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/10 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isPetMenuOpen}
                  onClick={() => setIsPetMenuOpen((isOpen) => !isOpen)}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-2xl ring-1 ring-amber-200 transition group-hover:scale-105">
                    {selectedPet.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-slate-950">{selectedPet.name}</span>
                    <span className="block truncate text-sm font-bold text-amber-800">{selectedPet.title}</span>
                  </span>
                  <span className={`shrink-0 text-amber-700 transition ${isPetMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                    ▾
                  </span>
                </button>

                {isPetMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-3xl border border-amber-200 bg-white/95 p-2 shadow-2xl shadow-amber-900/20 backdrop-blur"
                    role="listbox"
                    aria-label="Choose a release pet"
                  >
                    {petOptions.map((pet) => (
                      <button
                        key={pet.id}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-amber-50 ${pet.id === selectedPetId ? 'bg-amber-100 ring-1 ring-amber-200' : ''}`}
                        type="button"
                        role="option"
                        aria-selected={pet.id === selectedPetId}
                        onClick={() => handlePetChange(pet.id)}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xl ring-1 ring-amber-200">
                          {pet.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-black text-slate-950">{pet.name}</span>
                          <span className="block truncate text-sm font-bold text-slate-500">{pet.title}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                GitHub owner
                <input className={inputClass} value={owner} onChange={(event) => setOwner(event.target.value)} required pattern="[A-Za-z0-9_.\\-]+" />
              </label>
              <label className={labelClass}>
                Repo name
                <input className={inputClass} value={repo} onChange={(event) => setRepo(event.target.value)} required pattern="[A-Za-z0-9_.\\-]+" />
              </label>
            </div>

            <label className={labelClass}>
              Release tag
              <input className={inputClass} value={releaseTag} onChange={(event) => setReleaseTag(event.target.value)} required placeholder="v1.2.0" />
            </label>

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

            <p className={`min-h-6 ${statusClass}`}>{message || 'Images are resized client-side to WebP under 100 KB.'}</p>

            <button className={`${primaryButtonClass} w-full sm:w-auto`} type="submit" disabled={status === 'compressing' || status === 'uploading'}>
              {status === 'uploading' ? 'Uploading...' : 'Generate Markdown'}
            </button>
          </form>

          <aside className={`${cardClass} flex flex-col gap-4 sm:gap-5`}>
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">Preview</h2>
            {previewUrl ? (
              <img className="aspect-square w-full rounded-3xl bg-amber-100 object-cover" src={previewUrl} alt="Compressed pet preview" />
            ) : (
              <div className="grid min-h-56 place-items-center rounded-2xl border-2 border-dashed border-amber-200 p-4 text-center font-bold text-amber-800 sm:min-h-80 sm:rounded-3xl">
                Choose an image to preview the compressed WebP.
              </div>
            )}
            {compressed && <p className="text-slate-600">{formatBytes(compressed.blob.size)} · {compressed.width}×{compressed.height}</p>}
            {result && <a className="font-extrabold text-amber-700 underline decoration-amber-300 underline-offset-4" href={result.publicUrl} target="_blank" rel="noreferrer">Open public image</a>}
          </aside>
        </section>

        <section className={`${cardClass} mt-5 flex flex-col gap-4 sm:mt-6 sm:gap-5`}>
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-slate-950 sm:text-2xl">GitHub Markdown</h2>
            <button className={secondaryButtonClass} onClick={() => copyMarkdown(markdown)} type="button">
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
          </div>
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-50 sm:break-words sm:rounded-3xl sm:p-5 sm:text-sm sm:leading-6">{markdown}</pre>
          {result?.html && (
            <details className="font-bold text-slate-800">
              <summary className="cursor-pointer">HTML version with image width</summary>
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
