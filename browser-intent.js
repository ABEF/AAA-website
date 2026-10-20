// Deliberately local-only. Public signing needs separately reviewed deployment pins.
const ZERO='0x'+'0'.repeat(40), EMPTY='0x'+'0'.repeat(64);
const address=a=>typeof a==='string'&&/^0x[0-9a-f]{40}$/.test(a);
const word=v=>BigInt(v).toString(16).padStart(64,'0');
const addr=a=>a.slice(2).padStart(64,'0');
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
const fail=()=>{throw new Error('The unsigned transaction does not match your selected action. Nothing was sent.');};
export function validateBrowserManifest(m) {
  if(m?.schema!==1||m.mode!=='LOCAL ANVIL TEST ONLY'||m.chain_id!==31337||
    !/^0x[0-9a-f]{64}$/.test(m.genesis_hash)||!Array.isArray(m.accounts)||m.accounts.length!==2||
    m.accounts.some(a=>!address(a))||new Set(m.accounts).size!==2||
    !/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(m.rpc_url)||!/^0x[0-9a-f]{64}$/.test(m.pool))fail();
  const coreAddresses=new Set();
  for(const role of ['vault','nft','entry','claim_router']) {
    const c=m.contracts?.[role];
    if(!address(c?.address)||c.address===ZERO||coreAddresses.has(c.address)||!/^0x(?:[0-9a-f]{2})+$/.test(c.runtime_code)||c.runtime_code.length>100000)fail();
    coreAddresses.add(c.address);
  }
  if(!Array.isArray(m.input_assets)||m.input_assets.length!==4)fail();
  const symbols=new Set(),assetAddresses=new Set();
  for(const a of m.input_assets) {
    if(!['ETH','ZZZ','USDG','USDC'].includes(a.symbol)||symbols.has(a.symbol)||!address(a.address)||
      !Number.isInteger(a.decimals)||a.decimals<0||a.decimals>18||!/^0x[0-9a-f]{64}$/.test(a.route_id)||typeof a.enabled!=='boolean')fail();
    if((a.symbol==='ETH')!==(a.address===ZERO)||assetAddresses.has(a.address)||coreAddresses.has(a.address))fail();
    symbols.add(a.symbol);
    assetAddresses.add(a.address);
  }
  if(m.mint_value_wei!=='50000000000000000'||m.confirmations!==1||!Number.isInteger(m.max_gas)||m.max_gas<21000||m.max_gas>30000000)fail();
  for(const k of ['max_gas_price_wei','max_network_fee_wei'])if(typeof m[k]!=='string'||!/^[1-9][0-9]{0,29}$/.test(m[k]))fail();
  return m;
}
export function selectedClaims(state,intent) {
  const all=state.nfts.filter(n=>n.owner===intent.account&&(intent.action==='claim_all'||n.token_id===intent.id));
  const claims=[];let count=0;
  for(const n of all) {
    const entries=['lp','royalties'].flatMap(scope=>n.claimable[scope]
      .filter(a=>BigInt(a.raw)>0n&&(n.claimable.default_settlement!=='native_eth'||a.asset===ZERO))
      .map(a=>({token_id:n.token_id,asset:a.asset,royalty:scope==='royalties'})));
    if(entries.length){if(count===10||claims.length+entries.length>32)break;claims.push(...entries);count++;}
  }
  return claims;
}
// Reconstruct allowed calldata from the user's intent, never from a backend
// supplied "expected transaction". Bounds/deadline are decoded and checked.
export function expectedBrowserTransaction(draft,intent,m,state,now=Date.now()) {
  validateBrowserManifest(m);
  if(!intent||!m.accounts.includes(intent.account)||draft?.account!==intent.account||
    draft.chain_id!==31337||draft.requested_action!==intent.action||!draft.transaction)fail();
  const tx=draft.transaction;
  if(!same(tx.from,intent.account)||!same(tx.chainId,'0x7a69'))fail();
  const target=role=>m.contracts[role].address;
  let to,data,value='0x0';
  if(intent.action==='mint') {
    if(draft.action!=='mint')fail();
    to=target('vault');data='0x21bf772d';value='0xb1a2bc2ec50000';
  } else if(['claim','claim_all'].includes(intent.action)) {
    if(draft.action!=='claim')fail();
    const claims=selectedClaims(state,intent);
    if(!claims.length||claims.length>32||!Array.isArray(draft.claims)||draft.claims.length!==claims.length)fail();
    for(const [index,claim] of claims.entries()) {
      const display=draft.claims[index],nft=state.nfts.find(n=>n.token_id===claim.token_id&&n.owner===intent.account);
      const asset=nft?.claimable[claim.royalty?'royalties':'lp'].find(a=>a.asset===claim.asset);
      if(!display||!asset||display.token_id!==claim.token_id||display.asset!==claim.asset||display.royalty!==claim.royalty||
        display.symbol!==asset.symbol||display.decimals!==asset.decimals||
        typeof asset.symbol!=='string'||!Number.isInteger(asset.decimals)||asset.decimals<0||asset.decimals>36||
        typeof display.simulated_raw!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(display.simulated_raw)||
        BigInt(display.simulated_raw)>=2n**256n||BigInt(display.simulated_raw)>BigInt(asset.raw))fail();
    }
    to=target('claim_router');data='0xbbeaec93'+word(32)+word(claims.length)+claims.map(c=>word(c.token_id)+addr(c.asset)+word(c.royalty?1:0)).join('');
  } else if(['activate','increase'].includes(intent.action)) {
    if(typeof intent.amount!=='string'||!/^[1-9][0-9]{0,4}$/.test(intent.amount)||Number(intent.amount)>99999||
      (intent.action==='activate'?intent.amount!=='100':Number(intent.amount)<5))fail();
    const nft=state.nfts.find(n=>n.token_id===intent.id&&n.owner===intent.account);
    if(!nft||nft.position.activated!==(intent.action==='increase'))fail();
    const a=m.input_assets.find(a=>a.symbol===intent.asset&&a.enabled);
    if(!a||(a.symbol==='ETH'&&!m.native_eth_atomic))fail();
    const amount=BigInt(intent.amount)*10n**BigInt(a.decimals);
    if(draft.action==='approve') {
      if(a.symbol==='ETH')fail();
      to=a.address;data='0x095ea7b3'+addr(target('entry'))+word(amount);
      if(draft.approval_raw!==amount.toString()||draft.approval_asset!==a.symbol)fail();
    } else {
      if(draft.action!==intent.action||typeof tx.data!=='string'||!/^0x35b13b87[0-9a-f]{576}$/.test(tx.data))fail();
      const words=tx.data.slice(10).match(/.{64}/g);
      const minimum=BigInt('0x'+words[5]),liquidity=BigInt('0x'+words[6]),deadline=BigInt('0x'+words[7]);
      const floor=a.route_id===EMPTY?0n:BigInt(intent.amount)*10n**18n*99n/100n;
      if(minimum<floor||minimum>BigInt(intent.amount)*10n**18n||liquidity<1n||liquidity>=2n**128n||
        deadline<=BigInt(Math.floor(now/1000))||deadline>BigInt(Math.floor(now/1000)+180))fail();
      to=target('entry');value=a.symbol==='ETH'?'0x'+amount.toString(16):'0x0';
      data='0x35b13b87'+word(intent.id)+m.pool.slice(2)+addr(a.address)+word(amount)+a.route_id.slice(2)+word(minimum)+word(liquidity)+word(deadline)+word(intent.action==='increase'?1:0);
    }
    if(draft.contribution!==intent.amount||draft.contribution_asset!==a.symbol)fail();
  } else fail();
  if(!same(tx.to,to)||!same(tx.data,data)||BigInt(tx.value)!==BigInt(value))fail();
  return {from:intent.account,to,data,value,chainId:'0x7a69'};
}
