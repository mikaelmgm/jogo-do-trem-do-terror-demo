'use strict';
// ============================================================
//  SOLANA (devnet) — conexão de carteira + pagamento em SOL
//
//  • Com Phantom/Solflare instalada e a página servida via http
//    (rode jogar.bat), a carteira conecta de verdade.
//  • Preencha TREASURY com um endereço seu para que as compras
//    enviem SOL de verdade na devnet. Vazio = compra simulada.
//  • Sem carteira instalada, dá para usar a "carteira demo".
// ============================================================

const SOL_CONFIG = {
  cluster: 'devnet',
  TREASURY: '',
};

const Sol = {
  provider: null,
  pubkey: null,
  demo: false,
  balance: null,

  available() { return !!this.getProvider(); },
  getProvider() {
    if (window.phantom && window.phantom.solana && window.phantom.solana.isPhantom) return window.phantom.solana;
    if (window.solflare && window.solflare.isSolflare) return window.solflare;
    if (window.solana) return window.solana;
    return null;
  },
  web3() { return window.solanaWeb3 || null; },
  isReal() { return !!(this.pubkey && !this.demo && SOL_CONFIG.TREASURY && this.web3()); },
  short() { return this.pubkey ? this.pubkey.slice(0, 4) + '…' + this.pubkey.slice(-4) : ''; },
  conn() {
    const w3 = this.web3();
    if (!this._conn && w3) this._conn = new w3.Connection(w3.clusterApiUrl(SOL_CONFIG.cluster), 'confirmed');
    return this._conn;
  },

  async connect() {
    const p = this.getProvider();
    if (!p) throw new Error('Nenhuma carteira Solana encontrada');
    const res = await p.connect();
    this.provider = p;
    this.demo = false;
    this.pubkey = ((res && res.publicKey) || p.publicKey).toString();
    await this.refreshBalance();
    return this.pubkey;
  },
  connectDemo() {
    const abc = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let k = 'Demo';
    for (let i = 0; i < 40; i++) k += abc[Math.floor(Math.random() * abc.length)];
    this.demo = true;
    this.pubkey = k;
    this.balance = Game.s.demoSol;
    return k;
  },
  async disconnect() {
    try { if (this.provider && !this.demo) await this.provider.disconnect(); } catch (e) { }
    this.pubkey = null; this.provider = null; this.demo = false; this.balance = null;
  },

  async refreshBalance() {
    if (this.demo) { this.balance = Game.s.demoSol; return this.balance; }
    const c = this.conn();
    if (!c || !this.pubkey) return null;
    try {
      const lamports = await c.getBalance(new (this.web3().PublicKey)(this.pubkey));
      this.balance = lamports / 1e9;
    } catch (e) { this.balance = null; }
    return this.balance;
  },

  async airdrop() {
    if (this.demo) { Game.s.demoSol = Math.round((Game.s.demoSol + 1) * 1000) / 1000; this.balance = Game.s.demoSol; return 'demo'; }
    const c = this.conn();
    if (!c) throw new Error('Biblioteca Solana não carregou');
    const sig = await c.requestAirdrop(new (this.web3().PublicKey)(this.pubkey), 1e9);
    await c.confirmTransaction(sig, 'confirmed');
    await this.refreshBalance();
    return sig;
  },

  // paga `sol` e devolve { signature, simulated }
  async pay(sol) {
    if (!this.pubkey) throw new Error('Conecte uma carteira primeiro');
    if (!this.isReal()) {
      if (this.demo) {
        if (Game.s.demoSol + 1e-9 < sol) throw new Error('Saldo demo insuficiente — peça um airdrop');
        Game.s.demoSol = Math.round((Game.s.demoSol - sol) * 1000) / 1000;
        this.balance = Game.s.demoSol;
      }
      await new Promise(r => setTimeout(r, 1300));
      const abc = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let sig = '';
      for (let i = 0; i < 88; i++) sig += abc[Math.floor(Math.random() * abc.length)];
      return { signature: sig, simulated: true };
    }
    const w3 = this.web3(), c = this.conn();
    const from = new w3.PublicKey(this.pubkey);
    const tx = new w3.Transaction().add(w3.SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: new w3.PublicKey(SOL_CONFIG.TREASURY),
      lamports: Math.round(sol * w3.LAMPORTS_PER_SOL),
    }));
    tx.feePayer = from;
    const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const { signature } = await this.provider.signAndSendTransaction(tx);
    await c.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    await this.refreshBalance();
    return { signature, simulated: false };
  },

  explorer(sig) { return 'https://explorer.solana.com/tx/' + sig + '?cluster=' + SOL_CONFIG.cluster; },
};
