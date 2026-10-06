export const LEDGER_TYPES = { CREDIT: "credit", DEBIT: "debit", STAKE: "stake", WIN: "win", LOSS: "loss", FEE: "fee", REFUND: "refund" };
const FEE = 0.05;

export function createWallet(balance = 10000) {
  return { balance: Math.floor(balance), locked: 0, ledger: [] };
}

function entry(wallet, type, amount, reference) {
  const row = { id: `${Date.now()}_${wallet.ledger.length}`, type, amount: Math.floor(amount), reference, at: new Date().toISOString(), balance: wallet.balance, locked: wallet.locked };
  wallet.ledger.push(row);
  return row;
}

export function available(wallet) {
  return Math.max(0, wallet.balance - wallet.locked);
}

export function stake(wallet, amount, reference = "duel") {
  const value = Math.max(100, Math.floor(Number(amount) || 0));
  if (value > available(wallet)) return { ok: false, error: "INSUFFICIENT BET", wallet };
  wallet.balance -= value;
  wallet.locked += value;
  entry(wallet, LEDGER_TYPES.STAKE, value, reference);
  return { ok: true, stake: value, wallet };
}

export function settle(wallet, staked, won, reference = "duel") {
  const stakeValue = Math.max(0, Math.floor(Number(staked) || 0));
  wallet.locked = Math.max(0, wallet.locked - stakeValue);
  if (won) {
    const fee = Math.floor(stakeValue * FEE);
    const payout = stakeValue * 2 - fee;
    wallet.balance += payout;
    entry(wallet, LEDGER_TYPES.FEE, fee, reference);
    entry(wallet, LEDGER_TYPES.WIN, payout, reference);
    return { ok: true, payout, fee, wallet };
  }
  entry(wallet, LEDGER_TYPES.LOSS, stakeValue, reference);
  return { ok: true, payout: 0, fee: 0, wallet };
}

export function refund(wallet, staked, reference = "duel") {
  const stakeValue = Math.max(0, Math.floor(Number(staked) || 0));
  wallet.locked = Math.max(0, wallet.locked - stakeValue);
  wallet.balance += stakeValue;
  entry(wallet, LEDGER_TYPES.REFUND, stakeValue, reference);
  return { ok: true, wallet };
}
