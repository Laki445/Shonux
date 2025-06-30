
const express = require('express');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static('public'));

let sock;
let plugins = [];
fs.readdirSync('./plugins').forEach(file => {
  if (file.endsWith('.js')) {
    plugins.push(require('./plugins/' + file));
  }
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['RenderBot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot connected and ready');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    for (let plugin of plugins) {
      try {
        await plugin({ sock, body, from });
      } catch (e) { console.log('Plugin error:', e); }
    }
  });
}

app.post('/pair', async (req, res) => {
  const phone = req.body.phone;
  if (!/^\d{9,15}$/.test(phone)) return res.send('❌ Invalid number');
  try {
    const code = await sock.requestPairingCode(phone);
    await sock.sendMessage(phone + '@s.whatsapp.net', { text: '🤖 Bot connected! Try `.alive` or `.ping`' });
    res.send('✅ Code sent to ' + phone);
  } catch (err) {
    res.send('❌ Failed to send code');
  }
});

app.listen(port, () => {
  console.log('🌐 Server running on http://localhost:' + port);
  startBot();
});
