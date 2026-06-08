import { describe, expect, it } from 'vitest';
import { buildHtml, buildMarkdown } from './markdown';

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
