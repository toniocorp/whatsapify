import 'dotenv/config';
import whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { addTracksToPlaylist } from './services.mjs';
import { spotifyTrackIdRegex } from './utils.mjs';

const { Client, LocalAuth } = whatsapp;

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.once('ready', async () => {
  console.log('Scanning whatsapp chats');

  const chat = await client.getChatById(process.env.WHATSAPP_CHAT_ID);

  if (!chat) {
    console.log(`Chat ${process.env.WHATSAPP_CHAT_ID} not found`);
    process.exit(0);
  }

  console.log(`Fetching messages from chat ${chat.name}`);

  const messages = await chat.fetchMessages({ limit: 1000 });

  if (!messages.length) {
    console.log('No messages found');
    process.exit(0);
  }

  console.log(`Found ${messages.length} messages in chat`);

  const trackIds = messages.reduce((acc, message) => {
    const match = spotifyTrackIdRegex.exec(message.body);

    if (!match?.[1]) {
      return acc;
    }

    return [...new Set(acc.concat(match[1]))];
  }, []);

  console.log(`Found ${trackIds.length} unique track ids`);
  await addTracksToPlaylist(process.env.SPOTIFY_PLAYLIST_ID, trackIds);
  process.exit(0);
});

client.on('qr', (qr) => {
  console.log('Use your phone with whatsapp app to scan the QR code');
  qrcode.generate(qr, { small: true });
});

client.initialize();
