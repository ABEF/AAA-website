// Resource locks are UI coordination, never an authorization or chain nonce lock.
export function confirmedUpgrade({action,confirmed,before,after,previousLP,currentLP}) {
  const levels=['dormant','activated','enhanced','singularity'];
  const from=levels.indexOf(String(before).toLowerCase()),to=levels.indexOf(String(after).toLowerCase());
  if(!confirmed||!['activate','increase'].includes(action)||from<0||to<=from)return false;
  if(previousLP==null||currentLP==null)return false;
  try {return BigInt(currentLP)>BigInt(previousLP)&&BigInt(previousLP)>=0n;}catch{return false;}
}

let sparkleAudio=null,lastSparkle=-Infinity;
export function armUpgradeSound() {
  // Called within the user's contribution/confirmation gesture. Unlock silently.
  try {
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Audio)return;
    sparkleAudio ||= new Audio();
    if(sparkleAudio.state==='suspended')void sparkleAudio.resume().catch(()=>{});
  }catch{/* Audio is optional; it can never block a financial flow. */}
}
export function celebrateUpgrade(buttons) {
  if(document.hidden)return;
  const visible=[...buttons].filter(b=>{
    if(!b.isConnected||!b.getClientRects().length)return false;
    const image=b.querySelector('img');
    if(image&&!image.complete) {
      const finish=()=>{clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',finish);};
      const loaded=()=>{finish();if(image.naturalWidth)celebrateUpgrade([b]);};
      const timer=setTimeout(finish,2000);
      image.addEventListener('load',loaded,{once:true});image.addEventListener('error',finish,{once:true});
      return false;
    }
    return !image||image.naturalWidth>0;
  });
  if(!visible.length)return;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const b of visible) {
    b.classList.remove('nft-celebrating');void b.offsetWidth;b.classList.add('nft-celebrating');
    setTimeout(()=>b.classList.remove('nft-celebrating'),1400);
  }
  try {
    const ctx=sparkleAudio;
    if(!ctx||ctx.state!=='running'||performance.now()-lastSparkle<1400)return;
    lastSparkle=performance.now();
    // Five quiet ascending bell tones; final oscillator ends after 1.18 seconds.
    [1046.5,1318.5,1568,2093,2637].forEach((frequency,i)=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.13;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.024,start+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,start+.62);
      oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.66);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
  }catch{/* Keep confirmed state usable if audio is unavailable. */}
}

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
    next.loading='eager';next.fetchPriority='high';
    const overlay=previous.cloneNode(false);overlay.className='nft-artwork artwork-previous';overlay.alt='';overlay.setAttribute('aria-hidden','true');button.append(overlay);
    const finish=()=>{if(!next.naturalWidth){overlay.remove();return;}requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-revealed')));setTimeout(()=>overlay.remove(),300);};
    if(next.complete)finish();else {next.addEventListener('load',finish,{once:true});next.addEventListener('error',()=>overlay.remove(),{once:true});}
  }
}
