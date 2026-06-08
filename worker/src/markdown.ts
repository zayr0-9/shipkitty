export function buildMarkdown(input: {
  petName: string;
  petTitle?: string;
  caption?: string;
  publicUrl: string;
}) {
  const caption = input.caption?.trim() || `Release approved by ${input.petName} 🐾`;
  const title = input.petTitle?.trim();
  const titleLine = title ? `\n\n_${escapeMarkdown(input.petName)}, ${escapeMarkdown(title)}_` : '';

  return `<!-- petship:start -->\n### ${escapeMarkdown(caption)}\n\n![${escapeMarkdown(input.petName)} approved this release](${input.publicUrl})${titleLine}\n<!-- petship:end -->`;
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

  return `<!-- petship:start -->\n<p>\n  <strong>${escapeHtml(caption)}</strong><br />\n  <img src="${input.publicUrl}" width="180" alt="${escapeHtml(input.petName)} approved this release" />${titleLine}\n</p>\n<!-- petship:end -->`;
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
