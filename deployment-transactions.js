// Coordinates typed API reviews with the unchanged, local-only wallet signer.
// The user explicitly retained the Anvil restriction. No non-local signing.
import {BrowserWallet} from './browser-wallet.js';
import {raw,ZERO} from './deployment-api.js';
const hex=n=>'0x'+BigInt(n).toString(16),word=n=>BigInt(n).toString(16).padStart(64,'0');
const SOURCE_TOPIC='0x0b7799b44b2fea7595e7c3227a0d4457e298ff7304e8068aaec078f1d4ed76e0';
const fail=message=>{throw Error(message);};
const copy=value=>JSON.parse(JSON.stringify(value));
const quantity=value=>{if(typeof value==='string'&&/^0x[0-9a-fA-F]{1,64}$/.test(value))return BigInt(value);if(Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0))return BigInt(value);fail('Invalid node quantity');};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export class DeploymentTransactions {
  constructor(api,session,{walletOptions={},onProgress=()=>{},onChange=()=>{}}={}){
    const m=api.manifest,origin=new URL(api.origin),rpc=new URL(m.rpc_url);
    if(m.environment!=='rehearsal'||m.chain_id!==31337||origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||rpc.protocol!=='http:'||rpc.hostname!=='127.0.0.1')fail('Wallet submission is restricted to the isolated local Anvil rehearsal');
    this.api=api;this.session=session;this.options=walletOptions;this.onProgress=onProgress;this.onChange=onChange;
    this.wallet=null;this.provider=null;this.busy=false;this.handles=new WeakMap();this.last=null;
  }
  signer(){
    const s=this.session,m=this.api.manifest;
    if(!s.provider||!s.account)fail('Connect and select your wallet account first');
    if(this.provider!==s.provider){
      this.wallet?.close();this.provider=s.provider;
      const allowedTargets=Object.fromEntries(Object.values(m.contracts).map(c=>[c.address,c.runtime_code]));
      for(const a of m.input_assets)if(a.address!==ZERO)allowedTargets[a.address]=a.runtime_code;
      this.wallet=new BrowserWallet({...this.options,provider:s.provider,readProvider:this.api.reader,
        policy:{chainId:hex(m.chain_id),genesisHash:m.genesis_hash,confirmations:m.confirmations,allowedTargets,
          maxGas:hex(m.limits.gas),maxGasPrice:hex(m.limits.gas_price_wei),maxNetworkFee:hex(m.limits.network_fee_wei),maxValue:hex(m.limits.native_value_wei)},
        onProgress:this.onProgress,onChange:this.onChange});
    }
    this.wallet.activeAccount=s.account;return this.wallet;
  }
  pending(){return this.signer().getPending(this.session.account);}
  canSend(){this.signer();return true;}
  progress(value){try{this.onProgress(value);}catch{/* Presentation cannot change recovery. */}}
  async switchNetwork(){
    if(this.busy||this.pending())fail('Recover the saved operation before changing networks');
    const wallet=this.signer(),account=this.session.account,provider=this.session.provider,m=this.api.manifest;
    this.busy=true;
    try{
      await this.api.identity();
      // Explicit user gesture only. No inferred chain name or auto-added RPC.
      try{await wallet.request('wallet_switchEthereumChain',[{chainId:hex(m.chain_id)}],90000);}
      catch(error){if(error?.code===4902)fail('Add '+m.chain_name+' using the operator-reviewed network settings, then switch and retry.');throw error;}
      if(provider!==this.session.provider||account!==this.session.account)fail('Wallet selection changed during the network switch');
      await wallet.assertConnection(account);return true;
    }finally{this.busy=false;}
  }
  async prepare(intent,{afterApproval=false}={}){
    if(this.busy)fail('Another wallet operation is in progress');this.busy=true;
    try{
      const permission=await this.session.verify(),wallet=this.signer();
      if(wallet.getPending(permission.account))fail('Recover the saved transaction before reviewing another');
      await wallet.assertConnection(permission.account);
      const draft=await this.api.prepare({...intent,account:permission.account});
      // A confirmed approval never triggers a second approval silently, even if
      // price/allowance changed. The next review must be complete LP execution.
      if(afterApproval&&draft.action==='approve')fail('Approval is confirmed, but the exact allowance is no longer sufficient. No further transaction was sent. Refresh and review the changed amount.');
      await this.api.identity();await this.session.verify();
      if(permission.revision!==this.session.revision||permission.account!==this.session.account)fail('Wallet changed during preparation');
      const nonce=quantity(await this.api.reader.request({method:'eth_getTransactionCount',params:[permission.account,'pending']}));
      const transaction={...draft.transaction,gas:hex(draft.network_gas.gas_limit),gasPrice:hex(draft.network_gas.gas_price_wei),nonce:hex(nonce)};
      const context={deployment:this.api.manifest.id,action:draft.action,intent:draft.intent,
        amount:draft.source?.amount_raw??null,source:draft.source?.asset??null,pool:this.api.manifest.pool_id};
      const handle=wallet.review({transaction,expectedTransaction:draft.transaction,expiresAt:draft.expires_at*1000,context});
      const review=freeze({...copy(draft),transaction:copy(transaction),signing_enabled:true,
        notice:'Confirm this exact local Anvil transaction in your selected wallet.'});
      this.handles.set(review,{wallet,handle,permission,draft});return review;
    }finally{this.busy=false;}
  }
  async submit(review){
    if(this.busy)fail('Another wallet operation is in progress');
    const saved=this.handles.get(review);if(!saved)fail('Prepare a fresh reviewed transaction');
    this.busy=true;
    try{
      const {wallet,handle,permission,draft}=saved;
      try{
        await this.session.verify();
        if(permission.revision!==this.session.revision||permission.account!==this.session.account||wallet!==this.signer())fail('Wallet changed. Review again.');
        await this.api.identity();
        await this.api.provenance(draft.provenance,{activation:Boolean(draft.source),transaction:!draft.source});
        // Bind every core runtime again; target simulation alone must not hide a
        // changed dependency between preparation and the user's click.
        for(const c of Object.values(this.api.manifest.contracts)){
          if(await this.api.reader.request({method:'eth_getCode',params:[c.address,'latest']})!==c.runtime_code)fail('A reviewed contract implementation changed');
        }
      }catch(error){error.notSubmitted=true;throw error;}
      return await this.finish(wallet,await wallet.send(handle),permission.account);
    }finally{this.busy=false;}
  }
  async recover(hash){
    if(this.busy)fail('Another wallet operation is in progress');this.busy=true;
    try{const wallet=this.signer(),account=this.session.account;return await this.finish(wallet,await wallet.recover({account,...(hash?{hash}: {})}),account);}
    finally{this.busy=false;}
  }
  async finish(wallet,result,account){
    const record=wallet.getPending(account);this.last={...result,action:record?.context?.action};
    if(!['confirmed','failed'].includes(result.status))return this.last;
    if(record?.context?.deployment!==this.api.manifest.id)fail('Saved operation belongs to a different deployment. Keep its recovery record.');
    // Terminal chain confirmation is independent from indexer availability.
    // A lagging API keeps a durable confirmed record, never a new send prompt.
    this.progress({stage:'reconciling',hash:result.hash});
    try{
      await this.reconcile(record,result);
      await wallet.acknowledge(result.hash,{account});
      this.last={...result,action:record.context.action,intent:record.context.intent,reconciled:true};
    }catch(error){this.last={...result,action:record.context.action,reconciled:false,error:'Transaction '+result.status+' on-chain. '+error.message+' Refresh the same transaction; do not send it again.'};}
    return this.last;
  }
  async reconcile(record,result){
    if(result.status==='failed')return; // Reverted transaction has no LP effect.
    const api=this.api,m=api.manifest,c=record.context,number=Number(quantity(result.receipt.blockNumber));
    await api.identity();const p=await api.protocol();
    if(p.provenance.block_number<number)fail('Confirmed balances are still catching up.');
    const canonical=await api.reader.request({method:'eth_getBlockByNumber',params:[result.receipt.blockNumber,false]});
    if(canonical?.hash!==result.receipt.blockHash)fail('Receipt inclusion changed.');
    if(c.action==='activate'||c.action==='increase'){
      const receipt=await api.reader.request({method:'eth_getTransactionReceipt',params:[record.hash]});
      if(receipt?.blockHash!==result.receipt.blockHash||receipt.transactionHash!==record.hash||!Array.isArray(receipt.logs)||receipt.logs.length>2048)fail('LP execution receipt is unavailable.');
      const topicOwner='0x'+record.transaction.from.slice(2).padStart(64,'0'),topicId='0x'+word(c.intent.id);
      const matches=receipt.logs.filter(l=>l.address?.toLowerCase()===m.contracts.entry.address&&l.topics?.[0]===SOURCE_TOPIC&&l.topics.length===4&&l.topics[1]===topicOwner&&l.topics[2]===topicId&&l.topics[3]===c.pool);
      if(matches.length!==1||matches[0].removed===true||matches[0].blockHash!==result.receipt.blockHash||matches[0].transactionHash!==record.hash||!/^0x[0-9a-fA-F]{384}$/.test(matches[0].data))fail('Expected confirmed LP contribution event was not found.');
      const fields=matches[0].data.slice(2).match(/.{64}/g);
      if(fields[0]!=='0'.repeat(24)+c.source.slice(2)||BigInt('0x'+fields[1])!==raw(c.amount)||BigInt('0x'+fields[2])===0n||BigInt('0x'+fields[4])===0n||BigInt('0x'+fields[5])!==(c.action==='increase'?1n:0n))fail('Confirmed contribution differs from the selected NFT or amount.');
      const n=await api.snapshot(await api.request('/v1/nfts/'+c.intent.id));
      api.validateNFT(n,c.intent.id,n.owner);
      if(n.provenance.block_number<number||!n.position.activated||raw(n.position.shares_raw)===0n||!n.position.current_lp_value.available)fail('The NFT’s confirmed LP position is not available yet.');
    }
    // Mint and claim use exact target/calldata and a successful canonical receipt.
    // New income may accrue immediately after a claim: never demand zero balance.
  }
}
