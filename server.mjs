import {ARTWORKS} from './artworks.js';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? './dist/' : './',import.meta.url));
const port = Number(process.env.PORT || 4173);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number from 1 to 65535.');
const allowed = new Set(['index.html','styles.css','app.js','domain.js','wallet.js','ui-state.js','preview-store.js','local-client.js','local-view.js','local-view.css','browser-client.js','browser-wallet.js','browser-intent.js','deployment-api.js','deployment-session.js','deployment-view.js','deployment-config.js','assets/audio/activation.mp4','assets/audio/evolution.mp4','assets/logo.jpg','assets/collec.jpg','assets/nft.jpg','assets/favicon.svg','assets/videos/popl-explainer-v7.mp4','assets/videos/popl-explainer-v7.png','artworks.js','palette-system.js','assets/nfts/manifest.json','assets/nfts/inventory.json',...ARTWORKS.flatMap(art => [art.src.slice(2),art.metadata.slice(2)])]);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4','.json':'application/json; charset=utf-8'};
const server = createServer(async (request,response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{'Allow':'GET, HEAD'}); response.end('Method not allowed'); return; }
  let name;
  try { name = decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html'; }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  if (!allowed.has(name)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const data = await readFile(resolve(root,name));
    const headers = {'Content-Type':mime[extname(name)] || 'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
    if (extname(name) === '.mp4') {
      headers['Accept-Ranges'] = 'bytes';
      if (request.method === 'GET' && request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        const suffix = match && !match[1] && match[2] ? Number(match[2]) : null;
        const start = suffix !== null ? Math.max(0,data.length-suffix) : Number(match?.[1]);
        const end = suffix !== null || !match?.[2] ? data.length-1 : Math.min(Number(match[2]),data.length-1);
        if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= data.length || end < start || suffix === 0) {
          response.writeHead(416,{'Content-Range':`bytes */${data.length}`}); response.end(); return;
        }
        response.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${data.length}`});
        response.end(data.subarray(start,end+1)); return;
      }
    }
    response.writeHead(200,headers);
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error',error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT to another number.` : error.message); process.exitCode = 1; });
server.listen(port,'127.0.0.1',() => console.log(`PoPL website ready\nLocal: http://127.0.0.1:${port}\nPress Ctrl+C to stop.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(() => process.exit(0)));
