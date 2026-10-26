import {readFile,writeFile,copyFile,mkdir,lstat} from 'node:fs/promises';
import {dirname,resolve,relative,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ARTWORKS} from './artworks.js';
import {INTEGRATION_DEPLOYMENT} from './integration-config.js';
import {integrationPolicy,INTEGRATION_HOSTS} from './integration-app.js';

const ROOT=fileURLToPath(new URL('./',import.meta.url));
const digest=data=>createHash('sha256').update(data).digest('hex');
const exists=async path=>{try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
async function mapFiles(items,fn){
  const result=new Array(items.length);let index=0;
  await Promise.all(Array.from({length:Math.min(16,items.length)},async()=>{for(;;){const current=index++;if(current>=items.length)return;result[current]=await fn(items[current]);}}));
  return result;
}
export function integrationOutput(root,name){
  if(typeof name!=='string'||!/^dist-poplint(?:-[a-z0-9-]{1,64})?$/.test(name))throw Error('Integration output must be a new dist-poplint directory.');
  const output=resolve(root,name);
  if(dirname(output)!==resolve(root)||basename(output)!==name)throw Error('Integration output escaped the source root.');
  return output;
}
async function modules(entry,seen=new Set()){
  if(seen.has(entry))return seen;
  if(!/^[a-z0-9-]+\.js$/.test(entry))throw Error('Unexpected integration module path.');
  seen.add(entry);
  const source=await readFile(resolve(ROOT,entry),'utf8');
  const pattern=/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for(const match of source.matchAll(pattern)){
    const path=match[1]||match[2];
    if(!path.startsWith('./')||path.includes('..'))throw Error('Unexpected integration dependency path.');
    await modules(path.slice(2),seen);
  }
  return seen;
}

export async function buildIntegration({output='dist-poplint',revision=null}={}){
  if(revision!==null&&!/^[0-9a-f]{40}$/.test(revision))throw Error('Expected an exact source revision.');
  const destination=integrationOutput(ROOT,output);
  if(await exists(destination))throw Error('Integration output already exists; preserve it and use a new dist-poplint release directory.');
  const policy=integrationPolicy(INTEGRATION_DEPLOYMENT,'https://www.poplint.0xwave.com');
  const moduleFiles=[...await modules('integration-app.js')];
  if(moduleFiles.some(name=>['app.js','domain.js','preview-store.js','deployment-config.js'].includes(name)))throw Error('Integration must not include the demo application/configuration.');
  const assets=ARTWORKS.flatMap(art=>[art.src.slice(2),art.metadata.slice(2)]);
  const files=[...new Set([...moduleFiles,'styles.css','integration.css','local-view.css','assets/favicon.svg','assets/logo.jpg','assets/audio/activation.mp4','assets/audio/evolution.mp4','assets/nfts/manifest.json','assets/nfts/inventory.json',...assets])].sort();
  const sources=Object.fromEntries(await mapFiles([...files,'integration.html'],async name=>{
    if(name.includes('..')||name.startsWith('/')||name.includes('\\'))throw Error('Unsafe integration asset.');
    return [name,digest(await readFile(resolve(ROOT,name)))];
  }));
  const identity={schema:1,environment:'poplint-integration',hosts:[...INTEGRATION_HOSTS],canonical_origin:'https://www.poplint.0xwave.com',demo_origin:'https://www.popldemo.0xwave.com',source_revision:revision,
    deployment_configured:policy.state==='configured',deployment_id:policy.manifest?.id??null,
    public_signing:false,expected_contract_profile:{accounting_version:3,governance_version:2,fee_intake_version:1,pricing_version:2,routing_version:2,review_policy_version:1,canonical:'ZZZ_CANONICAL_SAME_CHAIN_NATIVE_LP_ONLY_V4'},
    configuration_status:policy.state,source_sha256:digest(JSON.stringify(sources)),asset_files:files.length};
  await mkdir(destination);
  await mapFiles(files,async name=>{await mkdir(dirname(resolve(destination,name)),{recursive:true});await copyFile(resolve(ROOT,name),resolve(destination,name));});
  await copyFile(resolve(ROOT,'integration.html'),resolve(destination,'index.html'));
  await writeFile(resolve(destination,'integration-config.js'),'// Poplint-only immutable build input. Public signing is disabled.\nexport const INTEGRATION_DEPLOYMENT = '+JSON.stringify(policy.manifest)+';\n');
  await writeFile(resolve(destination,'site-identity.json'),JSON.stringify(identity,null,2)+'\n');
  const published=[...files,'index.html','site-identity.json'].sort();
  const sums=await mapFiles(published,async name=>digest(await readFile(resolve(destination,name)))+'  '+name);
  await writeFile(resolve(destination,'SHA256SUMS'),sums.join('\n')+'\n');
  return {directory:destination,files:published.length,identity};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const opts={};
  for(let i=2;i<process.argv.length;i+=2){const arg=process.argv[i],value=process.argv[i+1];if(!value||!['--output','--revision'].includes(arg)||opts[arg.slice(2)]!==undefined)throw Error('Use --output dist-poplint[-release] and --revision <40-character commit>.');opts[arg.slice(2)]=value;}
  const result=await buildIntegration(opts);console.log(JSON.stringify({directory:result.directory,files:result.files,environment:result.identity.environment,configured:result.identity.deployment_configured,public_signing:false}));
}
