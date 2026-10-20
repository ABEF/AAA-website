// Independent EIP-1193 signing. This first profile is deliberately Anvil-only.
// The caller constructs expectedTransaction from the selected typed action and
// a separately reviewed deployment manifest, never from returned calldata.
const ADDRESS=/^0x[0-9a-fA-F]{40}$/,HASH=/^0x[0-9a-fA-F]{64}$/;
const QUANTITY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/;
const FIELDS=['from','to','data','value','chainId','gas','gasPrice','nonce'];
const READS=new Set(['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_getBalance',
  'eth_getTransactionCount','eth_call','eth_estimateGas','eth_gasPrice','eth_getTransactionReceipt',
  'eth_getTransactionByHash','eth_blockNumber']);
const TERMINAL=new Set(['confirmed','failed']);
const lower=x=>typeof x==='string'?x.toLowerCase():x;
const clone=x=>JSON.parse(JSON.stringify(x));
function address(x){if(typeof x!=='string'||!ADDRESS.test(x))throw Error('Invalid wallet or contract address');return lower(x);}
function quantity(x){if(typeof x!=='string'||!QUANTITY.test(x))throw Error('Invalid transaction quantity');return BigInt(x);}
function hash(x){if(typeof x!=='string'||!HASH.test(x))throw Error('Invalid transaction or block hash');return lower(x);}
function hex(x){return '0x'+x.toString(16);}
function same(a,b){return lower(a)===lower(b);}
function code(x){if(typeof x!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(x)||x.length>200002)throw Error('Invalid contract code pin');return lower(x);}
const nativeStorage=()=>{try{return globalThis.localStorage;}catch{return null;}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function normalizeTx(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...FIELDS].sort().join())throw Error('Unexpected transaction fields');
  if(typeof value.data!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(value.data)||value.data.length<10||value.data.length>32770)throw Error('Invalid transaction calldata');
  const result={from:address(value.from),to:address(value.to),data:lower(value.data)};
  for(const name of ['value','chainId','gas','gasPrice','nonce'])result[name]=hex(quantity(value[name]));
  return result;
}
function normalizeExpected(value){
  const names=['from','to','data','value','chainId'];
  if(!value||typeof value!=='object'||Object.keys(value).sort().join()!==names.sort().join())throw Error('Expected typed transaction must specify exactly five economic fields');
  if(typeof value.data!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(value.data))throw Error('Invalid expected calldata');
  return {from:address(value.from),to:address(value.to),data:lower(value.data),value:hex(quantity(value.value)),chainId:hex(quantity(value.chainId))};
}
function context(value){
  const text=JSON.stringify(value??null);
  if(text.length>2048)throw Error('Transaction recovery context is too large');
  return JSON.parse(text);
}

export class BrowserWallet {
  constructor({provider,policy,storage=nativeStorage(),locks=globalThis.navigator?.locks,onChange=()=>{},
    clock=()=>Date.now(),monotonic=()=>performance.now(),pause=wait,requestTimeoutMs=15000,
    receiptAttempts=3,receiptIntervalMs=750,submissionTimeoutMs=90000,random=()=>crypto.randomUUID()}={}){
    if(!provider||typeof provider.request!=='function')throw Error('A browser wallet is required');
    if(!policy||quantity(policy.chainId)!==31337n)throw Error('Only the reviewed local Anvil profile is enabled');
    if(!Number.isInteger(policy.confirmations)||policy.confirmations<1||policy.confirmations>32)throw Error('Invalid confirmation policy');
    if(!policy.allowedTargets||typeof policy.allowedTargets!=='object'||Array.isArray(policy.allowedTargets)||
      !Object.keys(policy.allowedTargets).length||Object.keys(policy.allowedTargets).length>32)throw Error('No reviewed transaction targets');
    this.policy={chainId:'0x7a69',genesisHash:hash(policy.genesisHash),allowedTargets:{},confirmations:policy.confirmations};
    for(const [target,bytes] of Object.entries(policy.allowedTargets))this.policy.allowedTargets[address(target)]=code(bytes);
    for(const name of ['maxGas','maxGasPrice','maxNetworkFee','maxValue'])this.policy[name]=hex(quantity(policy[name]));
    if(quantity(this.policy.maxGas)<21000n||quantity(this.policy.maxGas)>30000000n||!quantity(this.policy.maxGasPrice)||
      !quantity(this.policy.maxNetworkFee)||!quantity(this.policy.maxValue))throw Error('Invalid bounded transaction policy');
    if(!Number.isInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>30000||
      !Number.isInteger(submissionTimeoutMs)||submissionTimeoutMs<1||submissionTimeoutMs>120000||
      !Number.isInteger(receiptAttempts)||receiptAttempts<1||receiptAttempts>10||
      !Number.isInteger(receiptIntervalMs)||receiptIntervalMs<0||receiptIntervalMs>3000)throw Error('Invalid request bounds');
    this.provider=provider;this.storage=storage;this.locks=locks;this.onChange=onChange;this.clock=clock;
    this.monotonic=monotonic;this.pause=pause;this.requestTimeoutMs=requestTimeoutMs;this.submissionTimeoutMs=submissionTimeoutMs;
    this.receiptAttempts=receiptAttempts;this.receiptIntervalMs=receiptIntervalMs;this.random=random;
    this.changeVersion=0;this.activeAccount=null;this.busy=false;this.closed=false;this.reviews=new WeakMap();this.verifiedReceipts=new Map();
    this.listeners=[];
    for(const event of ['accountsChanged','chainChanged','disconnect']){
      const listener=()=>{this.changeVersion++;this.notify();};
      this.provider.on?.(event,listener);this.listeners.push([event,listener]);
    }
  }
  close(){this.closed=true;this.changeVersion++;for(const [event,fn] of this.listeners)this.provider.removeListener?.(event,fn);this.listeners=[];}
  notify(){try{this.onChange(this.pending);}catch{/* UI failure never changes transaction recovery. */}}
  key(account){return `popl-browser-pending-v1:${this.policy.chainId}:${this.policy.genesisHash}:${address(account)}`;}
  load(account){
    if(!this.storage)throw Error('Durable transaction recovery storage is unavailable');
    let raw;
    try{raw=this.storage.getItem(this.key(account));}catch{throw Error('Transaction recovery storage is unreadable');}
    if(raw===null)return null;
    try{
      if(typeof raw!=='string'||raw.length>40000)throw Error();
      const item=JSON.parse(raw),tx=normalizeTx(item.transaction);
      if(item.schema!==1||typeof item.id!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(item.id)||
        !['submitting','pending','confirmed','failed'].includes(item.status)||tx.from!==address(account)||
        tx.chainId!==this.policy.chainId||item.genesisHash!==this.policy.genesisHash||
        !Number.isFinite(item.createdAt)||!this.policy.allowedTargets[tx.to])throw Error();
      if(item.hash!==null)hash(item.hash);
      if(item.status!=='submitting'&&item.hash===null)throw Error();
      context(item.context);this.checkLimits(tx);
      return item;
    }catch{throw Error('Saved transaction record is invalid. Inspect it before submitting again');}
  }
  get pending(){return this.activeAccount?this.load(this.activeAccount):null;}
  getPending(account){return this.load(account);}
  save(item){
    try{
      const serialized=JSON.stringify(item);
      this.storage.setItem(this.key(item.transaction.from),serialized);
      if(this.storage.getItem(this.key(item.transaction.from))!==serialized)throw Error();
    }catch{throw Error('Transaction recovery could not be saved. Inspect wallet activity before retrying');}
    this.notify();
  }
  remove(item){
    if(this.load(item.transaction.from)?.id!==item.id)throw Error('Transaction recovery record changed');
    this.storage.removeItem(this.key(item.transaction.from));this.notify();
  }
  async locked(account,fn){
    if(this.closed)throw Error('Wallet connection is closed');
    if(!this.locks||typeof this.locks.request!=='function')throw Error('This browser cannot safely coordinate wallet submissions across tabs');
    return this.locks.request(this.key(account),{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock)throw Error('This wallet has an operation open in another tab');
      return fn();
    });
  }
  async request(method,params=[]){
    let timer;
    try{return await Promise.race([Promise.resolve().then(()=>this.provider.request({method,params})),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Wallet read timed out')),this.requestTimeoutMs);})]);}
    finally{clearTimeout(timer);}
  }
  read(method,params=[]){
    if(!READS.has(method))throw Error('Only bounded wallet reads are available');
    return this.request(method,params);
  }
  async assertConnection(account){
    if(this.closed)throw Error('Wallet connection is closed');
    const expected=address(account),version=this.changeVersion;
    const [accounts,chain,genesis]=await Promise.all([
      this.read('eth_accounts'),this.read('eth_chainId'),this.read('eth_getBlockByNumber',['0x0',false])
    ]);
    if(version!==this.changeVersion||!Array.isArray(accounts)||!same(accounts[0],expected))throw Error('Wallet account changed. Review again');
    if(quantity(chain)!==31337n||hash(genesis?.hash)!==this.policy.genesisHash)throw Error('Wallet network differs from this reviewed local deployment');
    return {account:expected,version};
  }
  checkLimits(tx){
    if(!this.policy.allowedTargets[tx.to]||tx.chainId!==this.policy.chainId)throw Error('Transaction destination or network is not approved');
    if(quantity(tx.gas)<21000n||quantity(tx.gas)>quantity(this.policy.maxGas)||!quantity(tx.gasPrice)||
      quantity(tx.gasPrice)>quantity(this.policy.maxGasPrice)||
      quantity(tx.gas)*quantity(tx.gasPrice)>quantity(this.policy.maxNetworkFee)||
      quantity(tx.value)>quantity(this.policy.maxValue))throw Error('Transaction exceeds the reviewed spending or gas policy');
  }
  review({transaction,expectedTransaction,expiresAt,context:recoveryContext=null}){
    if(this.closed)throw Error('Wallet connection is closed');
    const tx=normalizeTx(transaction),expected=normalizeExpected(expectedTransaction);
    for(const field of Object.keys(expected))if(tx[field]!==expected[field])throw Error('Returned transaction differs from the selected action');
    this.checkLimits(tx);
    const remaining=expiresAt-this.clock();
    if(!Number.isFinite(expiresAt)||remaining<=0||remaining>60000)throw Error('Transaction review expired or has an invalid lifetime');
    const handle=Object.freeze({transaction:Object.freeze({...tx}),expiresAt,context:Object.freeze({value:context(recoveryContext)})});
    this.reviews.set(handle,{tx,expiresAt,deadline:this.monotonic()+remaining,version:this.changeVersion,
      context:context(recoveryContext),used:false});
    this.activeAccount=tx.from;
    return handle;
  }
  validReview(item){
    if(this.closed||item.version!==this.changeVersion||item.used)throw Error('Wallet changed or review was already submitted');
    if(this.clock()>=item.expiresAt||this.monotonic()>=item.deadline)throw Error('Transaction review expired');
  }
  async preflight(item){
    const tx=item.tx;
    this.validReview(item);await this.assertConnection(tx.from);this.validReview(item);
    const [runtime,pendingNonce,balance,price,estimate]=await Promise.all([
      this.read('eth_getCode',[tx.to,'latest']),this.read('eth_getTransactionCount',[tx.from,'pending']),
      this.read('eth_getBalance',[tx.from,'pending']),this.read('eth_gasPrice'),
      this.read('eth_estimateGas',[tx,'pending'])
    ]);
    this.validReview(item);
    if(code(runtime)!==this.policy.allowedTargets[tx.to])throw Error('Contract code differs from the reviewed deployment');
    if(quantity(pendingNonce)!==quantity(tx.nonce))throw Error('This wallet sent another transaction. Review again');
    if(quantity(balance)<quantity(tx.value)+quantity(tx.gas)*quantity(tx.gasPrice))throw Error('Insufficient balance for value plus separate network gas');
    if(quantity(price)>quantity(tx.gasPrice)||!quantity(price))throw Error('Network gas changed. Review again');
    if(quantity(estimate)>quantity(tx.gas)||quantity(estimate)<21000n)throw Error('Gas requirement changed. Review again');
    await this.read('eth_call',[tx,'pending']);this.validReview(item);
    // A request can remain in the extension after this check. A late user
    // confirmation is still on-chain guarded, but cannot be cancelled by JS.
    await this.assertConnection(tx.from);this.validReview(item);
  }
  async send(handle){
    const item=this.reviews.get(handle);
    if(!item)throw Error('Use a validated transaction review');
    if(this.busy)throw Error('A wallet operation is already in progress');
    this.busy=true;
    try{return await this.locked(item.tx.from,async()=>{
      if(this.load(item.tx.from))throw Error('Recover the previous wallet transaction before preparing another');
      await this.preflight(item);
      const record={schema:1,id:this.random(),genesisHash:this.policy.genesisHash,status:'submitting',
        createdAt:this.clock(),transaction:clone(item.tx),context:clone(item.context),hash:null,receipt:null};
      if(typeof record.id!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(record.id))throw Error('Invalid recovery identity');
      this.save(record);item.used=true;this.activeAccount=item.tx.from;
      // There is exactly one send call. Neither timeout nor recovery repeats it.
      let timer;
      const submitting=Promise.resolve().then(()=>this.provider.request({method:'eth_sendTransaction',params:[clone(item.tx)]}));
      const tracked=submitting.then(value=>{
        const txHash=hash(value),saved=this.load(item.tx.from);
        if(saved?.id!==record.id)throw Error('Transaction recovery record changed');
        if(saved.hash&&saved.hash!==txHash)throw Error('Wallet returned inconsistent transaction hashes');
        record.hash=txHash;record.status='pending';this.save(record);return txHash;
      },error=>{
        // 4001 is a definitive user rejection of this exact request.
        // All other errors may follow submission and retain the journal.
        if(error?.code===4001){const saved=this.load(item.tx.from);if(saved?.id===record.id&&!saved.hash)this.remove(saved);}
        throw error;
      });
      try{
        await Promise.race([tracked,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),this.submissionTimeoutMs);})]);
      }catch(error){
        if(error?.code===4001){const rejected=Error('Transaction cancelled in the wallet');rejected.rejected=true;throw rejected;}
        return {status:'unresolved',hash:this.load(item.tx.from)?.hash??null,error:'Wallet submission is unresolved. Inspect the wallet and recover; do not submit again.'};
      }finally{clearTimeout(timer);}
      const saved=this.load(item.tx.from);
      if(!saved)return {status:'rejected',hash:null};
      if(!saved.hash)return {status:'unresolved',hash:null,error:'Wallet response is pending. Keep the original request; do not submit again.'};
      return this.poll(saved);
    });}finally{this.busy=false;}
  }
  async checkTransaction(record,tx){
    const expected=record.transaction;
    if(!tx||!same(tx.hash,record.hash)||!same(tx.from,expected.from)||!same(tx.to,expected.to)||
      !same(tx.input??tx.data,expected.data)||quantity(tx.value)!==quantity(expected.value)||
      quantity(tx.nonce)!==quantity(expected.nonce)||quantity(tx.chainId)!==31337n||
      quantity(tx.gasPrice)>quantity(expected.gasPrice))throw Error('Wallet transaction differs from the reviewed transaction. Inspect it before continuing');
    // Wallets may pad the gas limit. Recovery accepts that envelope only within
    // operator bounds; the canonical receipt must still fit the original review.
    const actualGas=quantity(tx.gas),actualPrice=quantity(tx.gasPrice);
    if(actualGas<21000n||actualGas>quantity(this.policy.maxGas)||!actualPrice||
      actualGas*actualPrice>quantity(this.policy.maxNetworkFee))throw Error('Wallet gas envelope exceeds the reviewed deployment policy');
  }
  async inspect(record){
    if(TERMINAL.has(record.status)){
      record={...record,status:'pending',receipt:null};this.save(record);
    }
    await this.assertNetwork();
    const receipt=await this.read('eth_getTransactionReceipt',[record.hash]);
    if(!receipt)return {status:'pending',hash:record.hash};
    const tx=await this.read('eth_getTransactionByHash',[record.hash]);await this.checkTransaction(record,tx);
    const number=hex(quantity(receipt.blockNumber)),blockHash=hash(receipt.blockHash);
    const used=quantity(receipt.gasUsed),paidPrice=quantity(receipt.effectiveGasPrice);
    const reviewedGas=quantity(record.transaction.gas),reviewedPrice=quantity(record.transaction.gasPrice);
    if(!same(receipt.transactionHash,record.hash)||!same(receipt.from,record.transaction.from)||
      !same(receipt.to,record.transaction.to)||quantity(receipt.transactionIndex)!==quantity(tx.transactionIndex)||
      !same(tx.blockHash,blockHash)||quantity(tx.blockNumber)!==quantity(receipt.blockNumber)||
      !['0x0','0x1'].includes(receipt.status)||used>quantity(tx.gas)||used>reviewedGas||
      paidPrice>quantity(tx.gasPrice)||paidPrice>reviewedPrice||
      used*paidPrice>reviewedGas*reviewedPrice)throw Error('Receipt does not match the reviewed transaction');
    const [block,head]=await Promise.all([this.read('eth_getBlockByNumber',[number,false]),this.read('eth_blockNumber')]);
    if(!same(block?.hash,blockHash))return {status:'pending',hash:record.hash,error:'Receipt moved out of the canonical chain; waiting for confirmation'};
    if(quantity(head)<quantity(number)+BigInt(this.policy.confirmations-1))return {status:'pending',hash:record.hash};
    // Check again after transaction/confirmation reads so one intermediate
    // receipt cannot be presented as final after an observed reorganization.
    const canonical=await this.read('eth_getBlockByNumber',[number,false]);
    if(!same(canonical?.hash,blockHash))return {status:'pending',hash:record.hash,error:'Receipt changed during verification'};
    // Logs are fetched and reconciled separately by the confirmed-state backend.
    // Keep the durable journal bounded even for a large combined-claim receipt.
    const summary={};
    for(const field of ['transactionHash','transactionIndex','blockNumber','blockHash','from','to','status','gasUsed','effectiveGasPrice'])summary[field]=receipt[field];
    const result={status:receipt.status==='0x1'?'confirmed':'failed',hash:record.hash,receipt:summary};
    this.save({...record,...result});return result;
  }
  async assertNetwork(){
    const [chain,genesis]=await Promise.all([this.read('eth_chainId'),this.read('eth_getBlockByNumber',['0x0',false])]);
    if(quantity(chain)!==31337n||hash(genesis?.hash)!==this.policy.genesisHash)throw Error('Switch back to the reviewed local network to recover this transaction');
  }
  async poll(record){
    for(let attempt=0;attempt<this.receiptAttempts;attempt++){
      let result;
      try{result=await this.inspect(record);}catch{result={status:'unresolved',hash:record.hash,error:'Receipt verification is unavailable or differs from the review. Recover status before continuing.'};}
      if(TERMINAL.has(result.status)){this.verifiedReceipts.set(record.hash,clone(result));return result;}
      if(attempt===this.receiptAttempts-1)return result;
      await this.pause(this.receiptIntervalMs);
    }
  }
  async recover({account=this.activeAccount,hash:providedHash}={}){
    if(this.busy)throw Error('A wallet operation is already in progress');
    if(!account){const accounts=await this.read('eth_accounts');account=accounts?.[0];}
    account=address(account);this.activeAccount=account;this.busy=true;
    try{return await this.locked(account,async()=>{
      let record=this.load(account);if(!record)return {status:'none',hash:null};
      if(providedHash){
        const candidate=hash(providedHash);
        if(record.hash&&record.hash!==candidate)throw Error('A different transaction hash is already recorded');
        await this.assertNetwork();
        const tx=await this.read('eth_getTransactionByHash',[candidate]);
        await this.checkTransaction({...record,hash:candidate},tx);
        record={...record,hash:candidate,status:'pending'};this.save(record);
      }
      if(!record.hash)return {status:'unresolved',hash:null,error:'The wallet has not supplied a transaction hash. Inspect its activity; never repeat this submission.'};
      // Terminal records are reverified before UI reconciliation, not trusted
      // merely because a previous tab saw a receipt.
      return this.poll(record);
    });}finally{this.busy=false;}
  }
  async acknowledge(txHash,{account=this.activeAccount}={}){
    account=address(account);
    return this.locked(account,async()=>{
      const record=this.load(account);
      if(!record||record.hash!==hash(txHash)||!TERMINAL.has(record.status))throw Error('Only a reconciled confirmed or failed transaction can be acknowledged');
      const reconciled=this.verifiedReceipts.get(record.hash);
      if(!reconciled)throw Error('Recover and reconcile this receipt before acknowledgement');
      const current=await this.inspect(record);
      if(!TERMINAL.has(current.status))throw Error('Receipt is no longer confirmed; recovery remains pending');
      if(current.status!==reconciled.status||['blockHash','blockNumber','transactionIndex','status'].some(field=>current.receipt[field]!==reconciled.receipt[field]))
        throw Error('Receipt inclusion changed after reconciliation. Recover its new inclusion before continuing');
      this.remove(record);this.verifiedReceipts.delete(record.hash);return current;
    });
  }
}
