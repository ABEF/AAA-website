import {LocalClient,validateState} from './local-client.js';
import {WalletConnection,validAddress} from './wallet.js';
import {BrowserWallet} from './browser-wallet.js';
import {validateBrowserManifest,expectedBrowserTransaction} from './browser-intent.js';

// Opt-in on the existing local mount only. Never turns the public demo live.
export const browserMode=location=>location.protocol==='http:'&&location.hostname==='127.0.0.1'&&location.pathname==='/app/'&&new URLSearchParams(location.search).get('wallet')==='browser';
function manifestState(raw,manifest) {
  const state=validateState(raw);
  if(JSON.stringify(state.accounts)!==JSON.stringify(manifest.accounts)||state.pool!==manifest.pool||
    ['nft','vault','entry','claim_router'].some(k=>state.contracts?.[k]!==manifest.contracts[k].address))throw new Error('Confirmed state does not match the reviewed local deployment.');
  return state;
}
async function accountRead(provider,method) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(()=>provider.request({method})),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Wallet account read timed out. Reconnect to read current permissions.')),15000);})]);
  } finally {clearTimeout(timer);}
}
export class BrowserClient extends LocalClient {
  constructor(options={}) {
    super(options);
    this.browser=true;this.providers=[];this.signer=null;this.manifest=null;
    this.recoveryHash=null;this.onWalletChange=()=>{};this.signerOptions=options.signerOptions||{};this.connectionVerified=false;
    this.wallet=new WalletConnection(()=>{this.connectionVerified=false;this.walletChanged();},options.walletStorage);
  }
  walletChanged() {
    const state=this.wallet.state;
    this.version++;
    this.account=state?.address?.toLowerCase()||null;
    const chain=typeof state?.chainId==='string'?state.chainId.toLowerCase():null;
    this.connectionError=this.account&&!this.accounts.includes(this.account)
      ?`Your wallet exposed ${this.account}. This is not Test wallet A or B. Click your wallet button to choose Test wallet A or B, or use “Choose a different account” to update this site's connected-account permissions.`
      :this.account&&chain!=='0x7a69'
        ?'Your wallet is connected to a different network. Use “Switch to the local network” below (chain ID 31337).':null;
    if(this.connectionError){this.account=null;this.connectionVerified=false;}
    if(this.wallet.requireAccountChoice){this.account=null;this.connectionVerified=false;}
    this.onWalletChange();
  }
  connectionFailed(error) {
    this.account=null;this.connectionVerified=false;
    this.connectionError=error?.message==='Wallet network differs from this reviewed local deployment'
      ?`The wallet is using a different local chain. Set its network RPC URL to ${this.manifest.rpc_url}, then reconnect.`
      :this.connectionError||error?.message||'Wallet connection could not be verified. Try again.';
    this.onWalletChange();
  }
  registerProvider(item) {
    if(this.providers.some(p=>p.provider===item.provider))return;
    this.providers.push(item);
    if(this.manifest)void this.restore().catch(error=>{this.connectionError=error.message;this.onSession();});
    this.onSession();
  }
  async restore() {
    if(!this.manifest)return;
    if(await this.wallet.restore(this.providers))this.attachSigner();
  }
  attachSigner() {
    if(!this.wallet.provider||!this.manifest)return;
    if(this.signer?.provider===this.wallet.provider)return;
    this.signer?.close?.();
    this.signer=new BrowserWallet({provider:this.wallet.provider,policy:this.manifest.policy,...this.signerOptions});
    this.pending=this.account?this.signer.getPending(this.account):null;
  }
  async connect(index,{chooseAccount=false,fromPicker=false}={}) {
    if(this.busy||this.pending||this.signer?.pending)throw new Error('Recover the pending transaction before changing wallets.');
    const p=this.providers[index];
    if(!p||!this.manifest)throw new Error('Refresh the local deployment first.');
    // A MetaMask button click asks for a fresh account choice, never saved permission reuse.
    chooseAccount ||= fromPicker&&(p.id==='io.metamask'||p.name==='MetaMask');
    this.busy=true;this.connectionError=null;
    try {
      // Reuse an already authorized provider through bounded public reads.
      // Repeating its permission request can emit accountsChanged and cancel
      // WalletConnection's in-flight authorization even for the same account.
      let reused=false;
      // Clicking a provider after an inadmissible restored/previous account
      // must offer selection, not loop through the same old permission.
      // Re-read first: an external wallet change may already have fixed it.
      if(!chooseAccount&&this.wallet.provider===p.provider&&this.wallet.state?.address&&
         !this.accounts.includes(this.wallet.state.address.toLowerCase())) {
        const exposed=await accountRead(p.provider,'eth_accounts');
        if(!Array.isArray(exposed)||exposed.some(account=>!validAddress(account)))throw new Error('Wallet returned invalid connected accounts.');
        chooseAccount=exposed.length>0&&!exposed.some(a=>this.accounts.includes(a.toLowerCase()));
      }
      if(chooseAccount) {
        this.wallet.requireAccountChoice=true;this.wallet.remember();this.account=null;
        // Explicit user gesture only: ask the selected extension to reopen its
        // account permissions, then use fresh accounts rather than saved state
        // or the permission response's account ordering.
        this.connectionVerified=false;
        let timer;
        try {
          await Promise.race([
            Promise.resolve().then(()=>p.provider.request({method:'wallet_requestPermissions',params:[{eth_accounts:{}}]})),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The account chooser is still open in your wallet. Complete it there, then reconnect.')),60000);})
          ]);
        } catch(error) {
          if(error?.code===4001)throw new Error('Account selection cancelled. Choose an account when you are ready.');
          if(error?.code===-32601||error?.code===4200)throw new Error('This wallet does not support the account chooser. Update this site’s connected-account permissions in the extension, then reconnect.');
          if(error?.code===-32002)throw new Error('An account request is already open in this wallet. Complete that request first.');
          throw error;
        } finally {clearTimeout(timer);}
        // Account-change events during the permission prompt are expected.
        // Final fresh reads and assertConnection below decide readiness.
        const accounts=await accountRead(p.provider,'eth_accounts');
        const chainId=await accountRead(p.provider,'eth_chainId');
        if(!Array.isArray(accounts)||!accounts.length||accounts.some(account=>!validAddress(account)))throw new Error('No valid account was authorized by the selected wallet.');
        this.wallet.requireAccountChoice=accounts.length>1;
        this.wallet.attach(p.provider,accounts,chainId,p.name,p.id);reused=true;
      }
      if(!reused&&this.wallet.provider===p.provider&&this.signer?.provider===p.provider) {
        const accounts=await this.signer.read('eth_accounts',[]);
        const chainId=await this.signer.read('eth_chainId',[]);
        if(this.wallet.provider!==p.provider)throw new Error('Wallet disconnected during connection. Reconnect it first.');
        if(!Array.isArray(accounts)||accounts.some(account=>!validAddress(account)))throw new Error('Wallet returned invalid connected accounts.');
        if(accounts.length){this.wallet.attach(p.provider,accounts,chainId,p.name,p.id);reused=true;}
        else this.wallet.disconnect();
      }
      if(!reused)await this.wallet.connect(p.provider,p.name,p.id);
      this.attachSigner();
      if(chooseAccount&&this.wallet.accounts.length>1) {
        // Permissions can include several accounts without identifying the popup selection.
        // Require an explicit account button instead of guessing or reusing the old sender.
        this.account=null;this.connectionError=null;this.connectionVerified=false;return;
      }
      if(this.connectionError&&!this.accounts.includes(this.wallet.state?.address?.toLowerCase())&&
         this.wallet.accounts.some(a=>this.accounts.includes(a.toLowerCase()))) {
        // A permitted fixture account is available but must be chosen by the
        // user, rather than inferred from the first account in the response.
        this.connectionError=null;this.connectionVerified=false;return;
      }
      if(this.connectionError)throw new Error(this.connectionError);
      await this.signer.assertConnection(this.account);
      this.connectionVerified=true;
      this.pending=this.account?this.signer.getPending(this.account):null;
    } catch(error) {
      this.connectionFailed(error);throw error;
    } finally {this.busy=false;}
  }
  async chooseAuthorizedAccount(account) {
    if(this.busy||this.pending||this.signer?.pending)throw new Error('Recover the pending transaction before changing wallets.');
    if(!validAddress(account)||!this.accounts.includes(account.toLowerCase())||!this.wallet.provider)throw new Error('Choose an authorized fixture account.');
    const provider=this.wallet.provider,name=this.wallet.state.name,id=this.wallet.state.providerId;
    this.busy=true;this.connectionVerified=false;this.connectionError=null;
    try {
      const accounts=await accountRead(provider,'eth_accounts');
      const chainId=await accountRead(provider,'eth_chainId');
      if(this.wallet.provider!==provider)throw new Error('The wallet changed during account selection.');
      if(!Array.isArray(accounts)||!accounts.some(a=>validAddress(a)&&a.toLowerCase()===account.toLowerCase()))throw new Error("Selected account is no longer authorized.");
      this.wallet.requireAccountChoice=false;
      this.wallet.attach(provider,accounts,chainId,name,id,account);
      this.attachSigner();
      if(this.connectionError)throw new Error(this.connectionError);
      await this.signer.assertConnection(account);
      this.connectionVerified=true;this.pending=this.signer.getPending(account);
    } catch(error) {this.connectionFailed(error);throw error;}
    finally {this.busy=false;}
  }
  select(account) {
    if(account!==null)throw new Error('Select an account in your browser wallet.');
    if(this.pending)throw new Error('Recover the pending transaction before disconnecting.');
    this.wallet.disconnect();this.signer?.close?.();this.signer=null;this.account=null;this.version++;
  }
  async setupNetwork() {
    if(!this.wallet.provider||!this.manifest)throw new Error('Connect a browser wallet first.');
    this.connectionError=null;
    try {
      try {await this.wallet.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7a69'}]});}
      catch(error) {
        if(error.code!==4902)throw error;
        await this.wallet.provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0x7a69',chainName:'PoPL disposable Anvil',rpcUrls:[this.manifest.rpc_url],nativeCurrency:{name:'Test Ether',symbol:'ETH',decimals:18}}]});
      }
      // Read the extension again; add-network acceptance alone is not a switch.
      const accounts=await this.wallet.provider.request({method:'eth_accounts'});
      const chainId=await this.wallet.provider.request({method:'eth_chainId'});
      if(!accounts.length)throw new Error('Select a disposable fixture account in the extension.');
      this.wallet.attach(this.wallet.provider,accounts,chainId,this.wallet.state?.name||'Browser wallet',this.wallet.state?.providerId||'browser');
      if(this.connectionError)throw new Error(this.connectionError);
      await this.signer.assertConnection(this.account);
      this.connectionVerified=true;
    } catch(error) {
      this.connectionFailed(error);throw error;
    }
  }
  async refreshState() {
    this.state=null;this.version++;
    const session=await this.request('/session');
    if(session.mode!=='LOCAL ANVIL TEST ONLY'||session.chain_id!==31337||!/^[a-f0-9]{64}$/.test(session.token))throw new Error('Unrecognized local session');
    const manifest=validateBrowserManifest(await this.request('/browser/manifest'));
    if(JSON.stringify(session.accounts)!==JSON.stringify(manifest.accounts))throw new Error('Deployment wallet inventory differs.');
    if(this.manifest&&(this.manifest.genesis_hash!==manifest.genesis_hash||JSON.stringify(this.manifest.policy)!==JSON.stringify(manifest.policy)))throw new Error('The Anvil deployment changed. Resolve saved transactions on their original chain before reconnecting.');
    this.session=session;this.accounts=session.accounts;this.manifest=manifest;
    await this.restore();this.attachSigner();this.walletChanged();
    if(this.account&&this.signer) {
      try {await this.signer.assertConnection(this.account);this.connectionVerified=true;}
      catch(error) {this.connectionFailed(error);}
    }
    let recovered=null;
    this.pending=this.signer&&(this.signer.pending||(this.account&&this.signer.getPending(this.account)))||null;
    if(this.pending) {
      recovered=await this.signer.recover({account:this.pending.transaction.from,hash:this.recoveryHash||undefined});
      this.recoveryHash=null;this.pending=this.signer.pending;
      if(['confirmed','failed'].includes(recovered.status))recovered=await this.observe(recovered);
    }
    const state=manifestState(await this.request('/state'),manifest);
    this.state=state;this.onSession();
    return recovered;
  }
  async prepare(action,extras={}) {
    if(!this.state||!this.account||!this.signer||this.pending||this.state.uncertain||this.connectionError)throw new Error('Connect your fixture account and refresh confirmed state first.');
    if(!['mint','activate','increase','claim','claim_all'].includes(action))throw new Error('Unsupported browser action.');
    const account=this.account,version=this.version;
    const intent={...extras,action,account};
    const draft=await this.request('/browser/prepare',intent);
    if(account!==this.account||version!==this.version)throw new Error('The wallet changed. Review again.');
    // Reconcile a fresh read after preparation: a different wallet may have acted.
    const state=manifestState(await this.request('/state'),this.manifest);
    if(account!==this.account||version!==this.version)throw new Error('The wallet changed. Review again.');
    const head=await this.signer.read('eth_getBlockByNumber',['latest',false]);
    if(!/^0x[0-9a-f]+$/i.test(head?.timestamp))throw new Error('The wallet returned an invalid chain clock.');
    const expectedTransaction=expectedBrowserTransaction(draft,intent,this.manifest,state,Number(BigInt(head.timestamp))*1000);
    const expiresAt=Math.min(draft.expires_at*1000,Date.now()+60000);
    const handle=await this.signer.review({transaction:draft.transaction,expectedTransaction,expiresAt,
      context:{draft_id:draft.draft_id,account,action:draft.action,requested_action:action,session:this.session.token}});
    if(account!==this.account||version!==this.version)throw new Error('The wallet changed. Review again.');
    this.state=state;
    // Bind the visible maximum to the exact validated wallet transaction.
    // Local inputs explicitly use $1 mock marks; this is not live USD pricing.
    const contribution=['activate','increase'].includes(action);
    const source=contribution?this.manifest.input_assets.find(asset=>asset.symbol===intent.asset):null;
    const gas=BigInt(draft.transaction.gas),gasPrice=BigInt(draft.transaction.gasPrice);
    return {...draft,browserHandle:handle,clientVersion:version,
      network_gas:{gas_limit:gas.toString(),gas_price_wei:gasPrice.toString(),max_cost_wei:(gas*gasPrice).toString()},
      contribution:contribution?intent.amount:null,contribution_asset:contribution?intent.asset:null,
      approval_raw:draft.action==='approve'?(BigInt(intent.amount)*10n**BigInt(source.decimals)).toString():null,
      approval_asset:draft.action==='approve'?source.symbol:null,
      minimum_lp_usd_18:contribution?(BigInt(intent.amount)*10n**18n*99n/100n).toString():null,
      claims:['claim','claim_all'].includes(action)?draft.claims:[]};
  }
  async observe(result,signer=this.signer) {
    const pending=signer.pending,context=pending?.context;
    if(!context||context.session!==this.session.token)throw new Error('Saved transaction belongs to another local session. Keep its hash for manual reconciliation.');
    const outcome=await this.request('/browser/confirm',{draft_id:context.draft_id,account:context.account,transaction_hash:result.hash});
    if(!['confirmed','failed'].includes(outcome.status))throw new Error('Transaction is still pending. Refresh to check the same hash.');
    await signer.acknowledge(result.hash);
    this.pending=null;
    return outcome;
  }
  async execute(draft) {
    if(this.busy||!draft?.browserHandle||draft.clientVersion!==this.version||draft.account!==this.account||this.pending)throw new Error('The wallet or review changed. Review again.');
    const signer=this.signer;this.busy=true;
    try {
      const result=await signer.send(draft.browserHandle);
      this.pending=signer.pending;
      if(!['confirmed','failed'].includes(result.status))throw new Error(result.error||'Transaction submitted or unresolved. Refresh its status; do not send it again.');
      const outcome=await this.observe(result,signer);
      this.state=null;this.version++;
      return outcome;
    } catch(error) {
      this.pending=signer.pending;
      if(error.code===4001&&!this.pending)error.rejected=true;
      throw error;
    } finally {this.busy=false;}
  }
}
