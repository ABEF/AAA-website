// Resource locks are UI coordination, never an authorization or chain nonce lock.
export class OperationTracker {
  constructor(context,{clock=()=>performance.now()}={}) { this.context=context; this.clock=clock; this.pending=new Map(); }
  begin(keys,kind) {
    const resources=[...new Set(keys)].sort();
    if(!resources.length||resources.some(key=>this.pending.has(key))) throw new Error('An action on this NFT is already pending. Wait for its result.');
    const operation={resources,kind,context:this.context(),deadline:this.clock()+15000,wallDeadline:Date.now()+15000};
    for(const key of resources)this.pending.set(key,operation);
    return operation;
  }
  assertCurrent(operation) {
    if(this.clock()>=operation.deadline||Date.now()>=operation.wallDeadline)throw new Error('This preview expired. Review the current state and try again.');
    if(operation.context!==this.context())throw new Error('Wallet or network changed. This preview was cancelled; review it again.');
    if(operation.resources.some(key=>this.pending.get(key)!==operation))throw new Error('This action is no longer current.');
  }
  cancelAll() { this.pending.clear(); }
  get(key) { return this.pending.get(key); }
  finish(operation) { if(operation)for(const key of operation.resources)if(this.pending.get(key)===operation)this.pending.delete(key); }
}

// Stable NFT identity survives routine refreshes; only a changed, loaded image fades.
export function preserveArtwork(container,render) {
  const old=new Map([...container.querySelectorAll('[data-art-owner]')].map(b=>[b.dataset.artOwner,b]));
  render();
  for(const button of container.querySelectorAll('[data-art-owner]')) {
    const previous=old.get(button.dataset.artOwner)?.querySelector('img'),next=button.querySelector('img');
    if(!previous||!next)continue;
    if(previous.getAttribute('src')===next.getAttribute('src')) { next.replaceWith(previous);continue; }
    const overlay=previous.cloneNode(false);overlay.className='nft-artwork artwork-previous';overlay.alt='';overlay.setAttribute('aria-hidden','true');button.append(overlay);
    const finish=()=>{if(!next.naturalWidth){overlay.remove();return;}requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-revealed')));setTimeout(()=>overlay.remove(),850);};
    if(next.complete)finish();else {next.addEventListener('load',finish,{once:true});next.addEventListener('error',()=>overlay.remove(),{once:true});}
  }
}
