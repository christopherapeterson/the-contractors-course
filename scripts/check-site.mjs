import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname,'..');
const dist = path.join(root,'dist');
const manifest = JSON.parse(await fs.readFile(path.join(dist,'data/site-manifest.json'),'utf8'));
const catalog = JSON.parse(await fs.readFile(path.join(dist,'data/catalog.json'),'utf8'));
const cards = JSON.parse(await fs.readFile(path.join(dist,'data/flashcards.json'),'utf8'));
assert.equal(catalog.length,12,'All course chapters must be included');
assert.equal(cards.length,81,'All flashcards must be included');
assert.equal(manifest.assets,87,'All recovered media must be included');
assert.equal(new Set(catalog.map((lesson) => lesson.path)).size,12,'Lesson routes must be unique');
for (const page of manifest.pages) {
  const html = await fs.readFile(path.join(dist,page.file),'utf8');
  assert(!html.includes('{{'),'Unresolved template variable in ' + page.file);
  assert(html.includes('<title>'),'Missing title in ' + page.file);
  assert(html.includes('id="main"'),'Missing main landmark in ' + page.file);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const pathname = decodeURIComponent(match[1]);
    const candidates = pathname === '/' ? ['index.html'] : [pathname.slice(1),pathname.slice(1) + '.html'];
    const exists = await Promise.all(candidates.map(async (candidate) => fs.access(path.join(dist,candidate)).then(() => true,() => false)));
    assert(exists.some(Boolean),'Broken internal link ' + pathname + ' in ' + page.file);
  }
  const rich = html.match(/<div class="reader-content">([\s\S]*?)<\/div><nav class="lesson-nav"/)?.[1] || '';
  assert(!/<script|onerror\s*=|onclick\s*=|javascript:/i.test(rich),'Unsafe lesson HTML in ' + page.file);
  assert(!/<img[^>]*src="https?:/i.test(rich),'Lesson image was not localized in ' + page.file);
}
for (const card of cards) {
  assert(card.question.trim() && card.answer.trim(),'An empty flashcard was generated');
  assert(!/<script|onerror\s*=|onclick\s*=|javascript:/i.test(card.question + card.answer),'Unsafe flashcard HTML');
}
console.log('Verified ' + manifest.pages.length + ' pages, all internal links, 12 chapters, 81 flashcards, 87 media files, and sanitized course HTML.');
