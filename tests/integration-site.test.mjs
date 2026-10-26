import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,rm,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {integrationPolicy,startIntegration,INTEGRATION_HOSTS} from '../integration-app.js';
import {integrationOutput,buildIntegration} from '../build-integration.mjs';
import {INTEGRATION_DEPLOYMENT} from '../integration-config.js';
import {DEPLOYMENT} from '../deployment-config.js';
import {currentSetup} from './helpers/deployment-current-fixture.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const digest=b=>createHash('sha256').update(b).digest('hex');

test('unconfigured integration is explicitly distinct from the unchanged public demo config',()=>{
  assert.equal(INTEGRATION_DEPLOYMENT,null);assert.equal(DEPLOYMENT,null);
  assert.deepEqual(INTEGRATION_HOSTS,['poplint.0xwave.com','www.poplint.0xwave.com']);
  for(const host of INTEGRATION_HOSTS)assert.equal(integrationPolicy(null,'https://'+host).state,'unconfigured');
});
test('an integration build cannot initialize on the demo, a lookalike host, HTTP public origin or file origin',()=>{
  for(const origin of ['https://popldemo.0xwave.com','https://www.popldemo.0xwave.com','https://poplint.0xwave.com.attacker.test','http://poplint.0xwave.com','file:///tmp/index.html'])assert.throws(()=>integrationPolicy(null,origin),/reserved/);
});
test('current deployment is validated without relabeling legacy manifests or changing input limits',()=>{
  const {m}=currentSetup();
  assert.equal(integrationPolicy(m,'http://127.0.0.1:4190').manifest.accounting_version,3);
  assert.equal(integrationPolicy(m,'http://127.0.0.1:4190').manifest.limits.maximum_contribution_loss_bps,200);
  for(const schema of [1,2,4])assert.throws(()=>integrationPolicy({...m,schema},'http://127.0.0.1:4190'),/accounting3/);
  assert.throws(()=>integrationPolicy({...m,accounting_version:2},'http://127.0.0.1:4190'),/accounting3/);
  assert.throws(()=>integrationPolicy(m,'https://www.poplint.0xwave.com'),/origin/);
});
test('null or malformed configuration never loads a wallet/view or discovers API configuration',async()=>{
  const before=globalThis.document,calls=[];
  const status={textContent:''};globalThis.document={documentElement:{dataset:{}},querySelector:()=>status};
  const load=()=>{calls.push('loaded');throw Error('must not load');};
  try{
    assert.deepEqual(await startIntegration({config:null,origin:'https://www.poplint.0xwave.com',loadView:load,loadWallets:load}),{state:'unconfigured'});
    assert.match(status.textContent,/No reviewed deployment/);
    assert.deepEqual(await startIntegration({config:{schema:2},origin:'https://www.poplint.0xwave.com',loadView:load,loadWallets:load}),{state:'error'});
    assert.deepEqual(calls,[]);
  }finally{if(before===undefined)delete globalThis.document;else globalThis.document=before;}
});
test('output guards refuse demo dist, absolute paths, traversal and unrelated deployment roots',()=>{
  for(const value of ['dist','../dist-poplint','/var/www/aaa-website','C:/tmp/dist-poplint','dist-poplint/child','dist-poplint-../demo','dist-poplint;demo'])assert.throws(()=>integrationOutput(ROOT,value));
  assert.equal(integrationOutput(ROOT,'dist-poplint'),resolve(ROOT,'dist-poplint'));
});
test('integration artifact includes only reviewed public files with environment identity and reproducible checksums',async()=>{
  const name='dist-poplint-test-'+process.pid+'-'+Date.now();
  const output=integrationOutput(ROOT,name);
  const demoBefore=await readFile(resolve(ROOT,'deployment-config.js'));
  const signerBefore=await readFile(resolve(ROOT,'browser-wallet.js'));
  const result=await buildIntegration({output:name,revision:'1'.repeat(40)});
  try{
    const identity=JSON.parse(await readFile(resolve(output,'site-identity.json'),'utf8'));
    assert.equal(identity.environment,'poplint-integration');assert.equal(identity.source_revision,'1'.repeat(40));assert.equal(identity.public_signing,false);assert.equal(identity.deployment_configured,false);assert.equal(identity.expected_contract_profile.accounting_version,3);
    const html=await readFile(resolve(output,'index.html'),'utf8');assert.match(html,/Deployment not configured/);assert.doesNotMatch(html,/\$425,000|PoPL #444|data-view="overview"|id="mint-submit"|src="\.\/app.js"/);
    for(const name of ['AGENTS.md','PROJECT_CONTEXT.md','.git','tests','app.js','domain.js','preview-store.js','deployment-config.js'])await assert.rejects(lstat(resolve(output,name)),{code:'ENOENT'});
    const lines=(await readFile(resolve(output,'SHA256SUMS'),'utf8')).trim().split('\n');assert.equal(lines.length,result.files);
    for(let start=0;start<lines.length;start+=16)await Promise.all(lines.slice(start,start+16).map(async line=>{assert.match(line,/^[a-f0-9]{64}  [a-zA-Z0-9/_.-]+$/);const [hash,path]=line.split('  ');assert.equal(digest(await readFile(resolve(output,path))),hash);}));
    await assert.rejects(buildIntegration({output:name}),/already exists/);
    assert.deepEqual(await readFile(resolve(ROOT,'deployment-config.js')),demoBefore);
    assert.deepEqual(await readFile(resolve(ROOT,'browser-wallet.js')),signerBefore);
  }finally{assert.equal(dirname(output),ROOT);assert.match(name,/^dist-poplint-test-/);await rm(output,{recursive:true,force:true});}
});
test('separate deployment templates cannot select or overwrite the demo document root',async()=>{
  const install=await readFile(resolve(ROOT,'deploy/install-integration-release.sh'),'utf8');
  const nginx=await readFile(resolve(ROOT,'deploy/popl-integration.nginx.conf'),'utf8');
  assert.match(install,/root=\/var\/www\/popl-integration/);assert.doesNotMatch(install,/root=\/var\/www\/aaa-website|root=\$|eval /);
  assert.match(install,/identity.get\('source_revision'\)!=release/);assert.match(install,/identity.get\('public_signing'\) is not False/);
  assert.match(install,/readlink -f "\$root\/releases"/);assert.match(install,/outside its own release root/);assert.match(install,/test ! -L "\$release_dir"/);
  assert.match(nginx,/root \/var\/www\/popl-integration\/current/);assert.doesNotMatch(nginx,/server_name[^;]*popldemo/);assert.match(nginx,/Cache-Control "no-store"/);assert.match(nginx,/location \^~ \/api\/ \{ return 503; \}/);
  assert.match(nginx,/ssl_protocols TLSv1.2 TLSv1.3/);assert.match(nginx,/script-src 'self'/);assert.match(nginx,/connect-src 'self'/);assert.match(nginx,/object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'/);
});
