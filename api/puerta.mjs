import {crearPuerta} from '../deploy/nube/puerta.mjs';
export const config={api:{bodyParser:false}};
let puerta;
export default async function handler(req,res){
 try{puerta ??= crearPuerta();return await puerta(req,res);}catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Falta configurar el despliegue de Kads.'}));}
}
