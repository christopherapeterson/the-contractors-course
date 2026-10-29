import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'webflow');
const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
const hash = (data) => createHash('sha256').update(data).digest('hex');
assert.equal(manifest.site_id, '6527313b854f07008c2d65a2', 'Unexpected Webflow site');
for (const page of Object.values(manifest.pages)) {
  assert.equal(hash(await fs.readFile(path.join(source, 'raw-pages', page.file))), page.sha256, 'Original source changed: ' + page.file);
  assert.equal(hash(await fs.readFile(path.join(source, 'site', page.file))), page.served_sha256, 'Captured page changed: ' + page.file);
}
for (const asset of Object.values(manifest.assets)) {
  assert.equal(hash(await fs.readFile(path.join(source, 'site', asset.file))), asset.served_sha256, 'Captured asset changed: ' + asset.file);
}
const homepage = await fs.readFile(path.join(source, 'site/index.html'), 'utf8');
assert(homepage.includes('Build your career as a Certified Contractor'), 'The original landing page is required');
assert(!homepage.includes('Build your next chapter.'), 'The discarded redesign must not be deployed');
const dist = path.join(root, 'dist');
await fs.rm(dist, { recursive: true, force: true });
await fs.cp(path.join(source, 'site'), dist, { recursive: true });
console.log(`Copied ${Object.keys(manifest.pages).length} original Webflow pages and ${Object.keys(manifest.assets).length} presentation assets to dist/.`);
