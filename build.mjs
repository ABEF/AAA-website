import {mkdir,copyFile} from 'node:fs/promises';
const files = ['index.html','styles.css','app.js','domain.js','wallet.js','assets/logo.jpg','assets/collec.jpg','assets/nft.jpg','assets/favicon.svg'];
await mkdir(new URL('./dist/assets/',import.meta.url),{recursive:true});
for (const name of files) await copyFile(new URL(name,import.meta.url),new URL(`dist/${name}`,import.meta.url));
console.log(`Static build complete: ${files.length} files in dist/. No dependency installation required.`);
