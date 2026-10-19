import {STORAGE_KEY,replayEvents,mintPreview,claimPreview,activatePreview,increasePreview} from './domain.js';

export const RESET_KEY=`${STORAGE_KEY}:reset`;
export function previewChange(collection,event) {
  switch(event.type) {
    case 'mint': return mintPreview(collection);
    case 'claim': return claimPreview(collection,event.ids,{scope:event.scope});
    case 'activate': return activatePreview(collection,event);
    case 'increase': return increasePreview(collection,event);
    default: throw new Error('Unknown preview action.');
  }
}

// Demo-only persistence. Chain data and signed transactions must never use this log.
export class PreviewStore {
  constructor(storage,locks) { this.storage=storage;this.locks=locks; }
  read() {
    const raw=this.storage.getItem(STORAGE_KEY)||'[]';
    if(raw.length>1000000)throw new Error('Saved preview is too large. Reset the example collection to continue.');
    let events;try {events=JSON.parse(raw);}catch {throw new Error('Saved preview is unreadable. Reset the example collection to continue.');}
    if(!Array.isArray(events)||events.length>1000)throw new Error('Saved preview is invalid. Reset the example collection to continue.');
    return {events,collection:replayEvents(events),epoch:this.epoch()};
  }
  epoch() {return this.storage.getItem(RESET_KEY)||'initial';}
  async lock(name,options,action) {
    if(!this.locks?.request)throw new Error('This browser cannot safely coordinate preview actions across tabs. Use a current browser on HTTPS or localhost.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try {return await this.locks.request(`${STORAGE_KEY}:${name}`,{...options,...(!options.ifAvailable?{signal:controller.signal}:{})},lock=>{
      clearTimeout(timer);
      if(!lock)throw new Error('This NFT is being updated in another tab. Wait for that action to finish.');
      return action();
    });}catch(error){if(error.name==='AbortError')throw new Error('Another tab is busy. Nothing was changed; try again shortly.');throw error;}
    finally {clearTimeout(timer);}
  }
  withResources(keys,action) {
    const sorted=[...new Set(keys)].sort();
    const acquire=index=>index===sorted.length?action():this.lock(`resource:${sorted[index]}`,{ifAvailable:true},()=>acquire(index+1));
    return acquire(0);
  }
  commit(event,epoch,assertCurrent=()=>{}) {
    return this.lock('events',{},()=>{
      assertCurrent();
      const latest=this.read();
      if(latest.epoch!==epoch)throw new Error('The preview was reset in another tab. Review the new state before trying again.');
      if(latest.events.length>=1000)throw new Error('The preview history is full. Reset it before adding more examples.');
      // Revalidate against latest state inside the lock; never publish a stale copy.
      const result=previewChange(latest.collection,event);
      this.storage.setItem(STORAGE_KEY,JSON.stringify([...latest.events,event]));
      return result;
    });
  }
  reset() {
    return this.lock('events',{},()=>{
      // Invalidate in-flight actions even when resetting an empty event log.
      this.storage.setItem(RESET_KEY,crypto.randomUUID());
      this.storage.setItem(STORAGE_KEY,'[]');
      return this.read();
    });
  }
}
