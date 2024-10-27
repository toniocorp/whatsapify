import 'dotenv/config';
import whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { addTracksToPlaylist } from './services.mjs';

const { Client, LocalAuth } = whatsapp;

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.once('ready', async () => {
  console.log('Scanning for spotify tracks');
  const messages = await client.searchMessages(
    'https://open.spotify.com/track/',
    {
      chatId: process.env.WHATSAPP_CHAT_ID,
      limit: 1000,      
    },
  );
  console.log(`Found ${messages.length} messages with spotify track links`);
  if (messages.length > 0) {
    const trackIds = messages.reduce((acc, message) => {
      const match = message.body.match(/(?<=track\/)([a-zA-Z0-9]{22})/g);
      if (!match?.[0]) {
        return acc;
      }

      return [...new Set(acc.concat(match))];
    }, []);
    console.log(`Found ${trackIds.length} tracks`);
    await addTracksToPlaylist(process.env.SPOTIFY_PLAYLIST_ID, trackIds);
    process.exit(0);
  }
});

client.on('qr', (qr) => {
  console.log('Use your phone with whatsapp app to scan the QR code');
  qrcode.generate(qr, { small: true });
});

client.initialize();
