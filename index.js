const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');

// Mantém o Render acordado
http.createServer((req,res)=>res.end('Bot ON')).listen(process.env.PORT||3000);

const ITENS = [
  { nome: "R5 5600", busca: "Ryzen 5 5600", max: 750 },
  { nome: "R7 5700X3D", busca: "Ryzen 7 5700X3D", max: 1200 },
  { nome: "2x16GB DDR4", busca: "Memoria 32GB 2x16 DDR4", max: 500 },
  { nome: "2x8GB DDR4", busca: "Memoria 16GB 2x8 DDR4", max: 500 },
  { nome: "SSD NVMe 1TB", busca: "SSD NVMe 1TB", max: 500 },
  { nome: "PS5", busca: "Playstation 5", max: 3200 },
  { nome: "Xbox Series S", busca: "Xbox Series S", max: 2000 },
   {
    nome: "RX 9070 XT",
    busca: "9070 XT RX 9070 XT Radeon 9070 XT",
    max: 3500
  },
  {
    nome: "RTX 12GB",
    busca: "RTX 4070 RTX 4070 Super RTX 5070 12GB RTX 12GB",
    max: 3800
  },
];

async function buscaAmazon(termo){
  try{
    const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(termo)}`;
    console.log(`[Amazon] Buscando: ${termo}`);
    await new Promise(r => setTimeout(r, 5000 + Math.random()*3000));
    
    const {data} = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 20000
    });
    const $ = cheerio.load(data);
    const achados = [];
    $('.s-result-item[data-component-type="s-search-result"]').each((i,el)=>{
      const titulo = $(el).find('h2 span').text();
      const precoInt = $(el).find('.a-price-whole').first().text();
      const precoDec = $(el).find('.a-price-fraction').first().text();
      const link = $(el).find('h2 a').attr('href');
      if(precoInt && link && titulo){
        const preco = parseFloat((precoInt+precoDec).replace(/\./g,'').replace(',','.'));
        if(preco) achados.push({titulo, preco, link: 'https://www.amazon.com.br'+link});
      }
    });
    return achados.slice(0,3);
  }catch(e){ console.log('Erro Amazon', termo, e.message); return []; }
}
async function start(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true, browser: ["Bot Ofertas","Chrome","1.0"] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (up)=>{
    const { connection, lastDisconnect, qr } = up;
    if(qr) { qrcode.generate(qr, {small:true}); console.log('ESCANEIE O QR ACIMA NO WHATSAPP'); }
    if(connection === 'open'){
      console.log('✅ CONECTADO! Procurando grupo...');
      await new Promise(r=>setTimeout(r,3000));
      const groups = await sock.groupFetchAllParticipating();
      let grupoId = Object.keys(groups).find(id=>groups[id].subject.toLowerCase().includes('oferta'));
      if(!grupoId) grupoId = Object.keys(groups)[0];
      console.log('Grupo alvo:', groups[grupoId]?.subject, grupoId);
      await sock.sendMessage(grupoId, {text: `✅ Bot de ofertas ativado!\nMonitorando:\n${ITENS.map(i=>`• ${i.nome} até R$${i.max}`).join('\n')}`});

      setInterval(async ()=>{
        console.log('Varrendo preços...');
        for(let item of ITENS){
          const res = await buscaAmazon(item.busca);
          for(let r of res){
            if(r.preco <= item.max){
              const msg = `🔥 *ACHADO! ${item.nome}*\n\n*${r.titulo.slice(0,100)}*\n💰 *R$${r.preco}* (meta: R$${item.max})\n\n🔗 ${r.link}`;
              await sock.sendMessage(grupoId, {text: msg});
            }
          }
          await new Promise(r=>setTimeout(r,2000));
        }
      }, 10*60*1000); // 10 min
    }
    if(connection==='close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut){
      start();
    }
  });
}
start();
