import {INTEGRATION_DEPLOYMENT} from './integration-config.js';
import {validateDeployment} from './deployment-api.js';

export const INTEGRATION_HOSTS=Object.freeze(['poplint.0xwave.com','www.poplint.0xwave.com']);
const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
export function integrationPolicy(value,origin){
  const page=new URL(origin);
  const local=LOCAL_HOSTS.has(page.hostname);
  if(!local&&(!INTEGRATION_HOSTS.includes(page.hostname)||page.protocol!=='https:'))throw Error('This build is reserved for the PoPL integration site.');
  if(value===null)return Object.freeze({state:'unconfigured',manifest:null});
  if(value?.schema!==3||value.accounting_version!==3)throw Error('Poplint requires an explicitly reviewed accounting3 deployment.');
  const manifest=validateDeployment(value,origin);
  if(!local&&manifest.environment!=='production')throw Error('A local rehearsal cannot be published as an integration deployment.');
  return Object.freeze({state:'configured',manifest});
}

function setStatus(message,state='unconfigured'){
  document.documentElement.dataset.integrationState=state;
  const node=document.querySelector('[data-integration-status]');
  if(node)node.textContent=message;
}

export async function startIntegration({config=INTEGRATION_DEPLOYMENT,origin=globalThis.location?.origin,loadView=()=>import('./deployment-view.js'),loadWallets=()=>import('./wallet.js')}={}){
  let policy;
  try{policy=integrationPolicy(config,origin);}catch{
    setStatus('Configuration unavailable. Contract reads and transaction preparation are disabled.','error');
    return {state:'error'};
  }
  // Null is deliberately not passed to app.js: that app's null profile is a demo.
  if(policy.state==='unconfigured'){
    setStatus('No reviewed deployment is configured. Balances and transactions are unavailable.');
    return {state:'unconfigured'};
  }
  try{
    const [{createDeploymentView},{WalletDiscovery}]=await Promise.all([loadView(),loadWallets()]);
    const template=document.querySelector('#integration-application');
    const shell=document.querySelector('[data-integration-shell]');
    if(!template||!shell)throw Error('Integration interface is incomplete.');
    shell.replaceWith(template.content.cloneNode(true));
    const view=createDeploymentView(policy.manifest);
    if(view.failed)throw Error('Reviewed deployment was rejected.');
    const route=()=>{
      const active=location.hash==='#collection'?'collection':'my-nfts';
      if(!['#collection','#my-nfts'].includes(location.hash))history.replaceState(null,'','#my-nfts');
      document.querySelectorAll('[data-view]').forEach(node=>node.hidden=node.dataset.view!==active);
      document.querySelectorAll('[data-nav]').forEach(node=>node.setAttribute('aria-current',node.dataset.nav===active?'page':'false'));
    };
    route();window.addEventListener('hashchange',route);
    document.addEventListener('click',event=>{
      const close=event.target.closest('[data-close-dialog]');
      if(close)close.closest('dialog')?.close();
    });
    const discovery=new WalletDiscovery(items=>view.setProviders(items));
    window.addEventListener('eip6963:announceProvider',event=>discovery.announce(event.detail));
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    discovery.legacy(window.ethereum);view.setProviders(discovery.items);
    view.updateWallet();view.renderMetrics();view.renderPortfolio();view.renderCollection();
    document.documentElement.dataset.integrationState='configured';
    return {state:'configured'};
  }catch{
    // A module/read/profile failure never starts the demo or exposes stale examples.
    document.querySelector('main')?.replaceChildren();
    const message=document.createElement('p');message.className='container integration-failure';message.setAttribute('role','alert');message.textContent='The reviewed integration could not initialize. Contract data remains unavailable. Reload after the operator restores the reviewed configuration.';
    document.body.append(message);
    document.querySelectorAll('[data-connect]').forEach(node=>node.disabled=true);
    document.documentElement.dataset.integrationState='error';
    return {state:'error'};
  }
}
if(typeof document!=='undefined')void startIntegration();
