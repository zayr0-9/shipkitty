import { describe, expect, it } from 'vitest';
import { buildHtml, buildMarkdown, upsertShipKittySnippet } from './markdown';

describe('markdown snippet generation', () => {
  it('escapes Markdown text content', () => {
    const markdown = buildMarkdown({
      petName: 'Bobby_[x]',
      petTitle: 'Chief *Purr* Officer',
      caption: 'Release [approved] (really)!',
      publicUrl: 'https://cdn.shipkitty.dev/r/karn/repo/v1/img_1.webp',
    });

    expect(markdown).toContain('### Release \\[approved\\] \\(really\\)\\!');
    expect(markdown).toContain('Bobby\\_\\[x\\] approved this release');
    expect(markdown).toContain('_Bobby\\_\\[x\\], Chief \\*Purr\\* Officer_');
  });

  it('escapes URL delimiters in Markdown URLs', () => {
    const markdown = buildMarkdown({
      petName: 'Bobby',
      publicUrl: 'https://cdn.example.test/r/owner/repo/tag/img_(1).webp',
    });

    expect(markdown).toContain('(https://cdn.example.test/r/owner/repo/tag/img_%281%29.webp)');
  });

  it('escapes HTML attributes and text content', () => {
    const html = buildHtml({
      petName: 'Bobby "Cat"',
      petTitle: '<CPO>',
      caption: '<approved & shipped>',
      publicUrl: 'https://cdn.example.test/img.webp?x="bad"&y=<tag>',
    });

    expect(html).toContain('&lt;approved &amp; shipped&gt;');
    expect(html).toContain('src="https://cdn.example.test/img.webp?x=&quot;bad&quot;&amp;y=&lt;tag&gt;"');
    expect(html).toContain('alt="Bobby &quot;Cat&quot; approved this release"');
    expect(html).toContain('<em>Bobby &quot;Cat&quot;, &lt;CPO&gt;</em>');
  });
});

describe('upsertShipKittySnippet', () => {
  const snippet = '<!-- shipkitty:start -->\nnew cat\n<!-- shipkitty:end -->';

  it('uses the snippet as the body when release notes are empty', () => {
    expect(upsertShipKittySnippet(null, snippet)).toEqual({ body: snippet, mode: 'inserted' });
  });

  it('appends the snippet after existing release notes', () => {
    expect(upsertShipKittySnippet('## Changes\n- Fixed bug', snippet)).toEqual({
      body: `## Changes\n- Fixed bug\n\n${snippet}`,
      mode: 'inserted',
    });
  });

  it('replaces an existing ShipKitty block without duplicating it', () => {
    const existing = 'Intro\n\n<!-- shipkitty:start -->\nold dog\n<!-- shipkitty:end -->\n\nOutro';
    expect(upsertShipKittySnippet(existing, snippet)).toEqual({
      body: `Intro\n\n${snippet}\n\nOutro`,
      mode: 'replaced',
    });
  });

  it('reports unchanged when the existing ShipKitty block is identical', () => {
    expect(upsertShipKittySnippet(snippet, snippet)).toEqual({ body: snippet, mode: 'unchanged' });
  });
});
