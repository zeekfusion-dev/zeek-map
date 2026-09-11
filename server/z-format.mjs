export const numberZ=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(value||0));
export const unitZ=value=>Number(value)===1?'Z':'Zs';
export const amountZ=value=>`${numberZ(value)} ${unitZ(value)}`;
