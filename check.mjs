import {ARTWORKS} from './artworks.js';
import {readFile,access} from 'node:fs/promises';
const html = await readFile(new URL('./index.html',import.meta.url),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML element IDs.');
const localFiles = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(match => match[1]);
for (const path of new Set(localFiles)) await access(new URL(path,import.meta.url));
const js = await readFile(new URL('./app.js',import.meta.url),'utf8');
for (const match of js.matchAll(/\$\('#([a-z][a-z0-9-]*)'\)/g)) if (!ids.includes(match[1])) throw new Error(`Missing UI element: ${match[1]}`);
for (const route of ['overview','collection','artworks','mint','my-nfts']) if (!html.includes(`data-view="${route}"`)) throw new Error(`Missing page: ${route}`);
if (!html.includes('Minting and claims are simulated')) throw new Error('Missing demo disclosure.');
console.log(`Checked ${ids.length} unique element IDs, ${new Set(localFiles).size} local references, application selectors, and all five routes.`);

if (ARTWORKS.length !== 72 || new Set(ARTWORKS.map(art => art.id)).size !== 72) throw new Error('Artwork catalog must have72 unique variants.');
for (const art of ARTWORKS) { await access(new URL(art.src,import.meta.url)); const metadata = JSON.parse(await readFile(new URL(art.metadata,import.meta.url),'utf8')); if (metadata.attributes.find(trait => trait.trait_type === 'Royalty Weight')?.value !== art.royaltyWeight) throw new Error('Incorrect royalty weight metadata: '+art.id); }
console.log('Verified72 standalone artwork files and their royalty/evolution metadata.');
