import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? './dist/' : './',import.meta.url));
const port = Number(process.env.PORT || 4173);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number from 1 to 65535.');
const allowed = new Set(['index.html','styles.css','app.js','domain.js','wallet.js','assets/logo.jpg','assets/collec.jpg','assets/nft.jpg','assets/favicon.svg']);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server = createServer(async (request,response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{'Allow':'GET, HEAD'}); response.end('Method not allowed'); return; }
  let name;
  try { name = decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html'; }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  if (!allowed.has(name)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const data = await readFile(resolve(root,name));
    response.writeHead(200,{'Content-Type':mime[extname(name)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error',error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT to another number.` : error.message); process.exitCode = 1; });
server.listen(port,'127.0.0.1',() => console.log(`PoPL website ready\nLocal: http://127.0.0.1:${port}\nPress Ctrl+C to stop.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(() => process.exit(0)));
