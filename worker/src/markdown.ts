export function buildMarkdown(input: {
  petName: string;
  petTitle?: string;
  caption?: string;
  publicUrl: string;
}) {
  const caption = input.caption?.trim() || `Release approved by ${input.petName} 🐾`;
  const title = input.petTitle?.trim();
  const titleLine = title ? `\n\n_${escapeMarkdown(input.petName)}, ${escapeMarkdown(title)}_` : '';

  return `<!-- shipkitty:start -->\n### ${escapeMarkdown(caption)}\n\n![${escapeMarkdown(input.petName)} approved this release](${escapeMarkdownUrl(input.publicUrl)})${titleLine}\n<!-- shipkitty:end -->`;
}

export function buildHtml(input: {
  petName: string;
  petTitle?: string;
  caption?: string;
  publicUrl: string;
}) {
  const caption = input.caption?.trim() || `Release approved by ${input.petName} 🐾`;
  const title = input.petTitle?.trim();
  const titleLine = title ? `<br />\n  <em>${escapeHtml(input.petName)}, ${escapeHtml(title)}</em>` : '';

  return `<!-- shipkitty:start -->\n<p>\n  <strong>${escapeHtml(caption)}</strong><br />\n  <img src="${escapeHtml(input.publicUrl)}" width="180" alt="${escapeHtml(input.petName)} approved this release" />${titleLine}\n</p>\n<!-- shipkitty:end -->`;
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

function escapeMarkdownUrl(value: string) {
  return encodeURI(value).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export type ShipKittySnippetMode = 'inserted' | 'replaced' | 'unchanged';

export function upsertShipKittySnippet(existingBody: string | null | undefined, snippet: string): { body: string; mode: ShipKittySnippetMode } {
  const body = existingBody?.trimEnd() ?? '';
  const pattern = /<!-- shipkitty:start -->[\s\S]*?<!-- shipkitty:end -->/;

  if (pattern.test(body)) {
    const nextBody = body.replace(pattern, snippet);
    return { body: nextBody, mode: nextBody === body ? 'unchanged' : 'replaced' };
  }

  return { body: body ? `${body}\n\n${snippet}` : snippet, mode: 'inserted' };
}
