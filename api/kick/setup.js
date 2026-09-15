export default function handler(req,res){res.setHeader('Cache-Control','no-store');return res.status(410).json({error:'Setup endpoint retired. Use Z Market controls.'});}
