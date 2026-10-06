// Client-safe virtual BET ledger primitives.
// Production balances must be enforced server-side with a database transaction.
export const LEDGER_TYPES={
  CREDIT:"credit",DEBIT:"debit",STAKE:"stake",WIN:"win",LOSS:"loss",FEE:"fee",REFUND:"refund"
};

export function createLedgerEntry({walletId,type,amount,reference,metadata={}}){
  const value=Math.max(0,Math.floor(Number(amount)||0));
  if(!walletId||!LEDGER_TYPES[type?.toUpperCase()]) throw new Error("Invalid ledger entry");
  return {id:crypto.randomUUID(),walletId,type,amount:value,reference:reference||null,metadata,createdAt:new Date().toISOString()};
}

export function calculateDuelSettlement(stake,platformFeeRate=.05){
  const s=Math.max(0,Math.floor(Number(stake)||0));
  const fee=Math.floor(s*platformFeeRate);
  return {stake:s,fee,payout:s*2-fee};
}
