import {ARTWORKS} from './artworks.js';
import {dirname} from 'node:path';
import {mkdir,copyFile} from 'node:fs/promises';
const files = ['index.html','styles.css','app.js','domain.js','wallet.js','assets/logo.jpg','assets/collec.jpg','assets/nft.jpg','assets/favicon.svg','artworks.js','assets/nfts/manifest.json',...ARTWORKS.flatMap(art => [art.src.slice(2),art.metadata.slice(2)])];
await mkdir(new URL('./dist/assets/',import.meta.url),{recursive:true});
for (const name of files) { await mkdir(new URL(`dist/${dirname(name)}/`,import.meta.url),{recursive:true}); await copyFile(new URL(name,import.meta.url),new URL(`dist/${name}`,import.meta.url)); }
console.log(`Static build complete: ${files.length} files in dist/. No dependency installation required.`);
