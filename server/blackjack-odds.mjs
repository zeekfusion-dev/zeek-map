export function handTotal(cards){let total=cards.reduce((sum,c)=>sum+Math.min(c%13+1,10),0);if(cards.some(c=>c%13===0)&&total+10<=21)total+=10;return total;}
// Conditional odds use only visible cards. The hidden dealer card stays unknown.
export function hitOdds(player,dealer){const seen=new Set([...player,...dealer.filter(c=>c!==null)]);let safe=0,total=0;for(let c=0;c<52;c++){if(seen.has(c))continue;total++;if(handTotal([...player,c])<=21)safe++}return {safe:safe/total,bust:(total-safe)/total};}
