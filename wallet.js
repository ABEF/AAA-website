export function validAddress(value) { return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value); }
export function walletError(error) {
  if (error?.code === 4001) return 'Connection cancelled. You can try again or use the demo wallet.';
  if (error?.code === -32002) return 'A wallet request is already open. Check your wallet extension.';
  return 'Could not connect to this wallet. Try again or use the demo wallet.';
}

export class WalletConnection {
  constructor(onChange) { this.onChange = onChange; this.provider = null; this.state = null; this.accountsHandler = null; this.chainHandler = null; this.disconnectHandler = null; }
  async connect(provider, name = 'Browser wallet') {
    if (!provider || typeof provider.request !== 'function') throw new Error('A browser wallet is not available.');
    const accounts = await provider.request({method:'eth_requestAccounts'});
    if (!Array.isArray(accounts) || !validAddress(accounts[0])) throw new Error('No valid account returned by this wallet.');
    let chainId = null;
    try { chainId = await provider.request({method:'eth_chainId'}); } catch { /* Chain information is optional for this transaction-free preview. */ }
    this.clearListeners();
    this.provider = provider;
    this.state = {address:accounts[0], name, chainId, type:'browser'};
    this.accountsHandler = list => {
      if (!Array.isArray(list) || !validAddress(list[0])) return this.disconnect();
      this.state = {...this.state,address:list[0]}; this.onChange(this.state);
    };
    this.chainHandler = chain => { if (this.state) { this.state = {...this.state,chainId:chain}; this.onChange(this.state); } };
    this.disconnectHandler = () => this.disconnect();
    if (typeof provider.on === 'function') {
      provider.on('accountsChanged',this.accountsHandler);
      provider.on('chainChanged',this.chainHandler);
      provider.on('disconnect',this.disconnectHandler);
    }
    this.onChange(this.state);
    return this.state;
  }
  connectDemo(address) {
    this.clearListeners(); this.provider = null;
    this.state = {address,name:'Demo wallet',chainId:null,type:'demo'}; this.onChange(this.state);
  }
  clearListeners() {
    if (typeof this.provider?.removeListener === 'function') {
      for (const [event,handler] of [['accountsChanged',this.accountsHandler],['chainChanged',this.chainHandler],['disconnect',this.disconnectHandler]]) if (handler) this.provider.removeListener(event,handler);
    }
  }
  disconnect() { this.clearListeners(); this.provider = null; this.state = null; this.onChange(null); }
}
