export function handTotal(cards){let total=cards.reduce((sum,c)=>sum+Math.min(c%13+1,10),0);if(cards.some(c=>c%13===0)&&total+10<=21)total+=10;return total;}
// A playing hand also tells us the dealer did not have a natural blackjack.
// Average over possible hidden cards; never inspect the actual private card.
export function hitOdds(player,dealer){const seen=new Set([...player,...dealer.filter(c=>c!==null)]);const unknown=Array.from({length:52},(_,i)=>i).filter(c=>!seen.has(c));const up=dealer[0]%13+1;const allowed=c=>up===1?c%13+1<10:up>=10?c%13!==0:true;const holes=unknown.filter(allowed).length;const denominator=holes*(unknown.length-1);const safe=unknown.filter(c=>handTotal([...player,c])<=21).reduce((n,c)=>n+holes-Number(allowed(c)),0)/denominator;return {safe,bust:1-safe};}
