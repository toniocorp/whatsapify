#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import 'dotenv/config';
import { addTracksToPlaylist, extractSpotifyTracksFromFile } from './services.mjs';
import whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { spotifyTrackIdRegex } from './utils.mjs';
import express from 'express';
import axios from 'axios';
import open from 'open';
import fse from 'fs-extra';
import { URLSearchParams } from 'url';
import ora from 'ora';
import dotenv from 'dotenv';

const { Client, LocalAuth } = whatsapp;

const program = new Command();

program
  .name('whatsapify')
  .description('CLI to add Spotify tracks to a playlist from WhatsApp messages or text files')
  .version('1.0.0')
  .action(async () => {
    await startWizard();
  });

async function startWizard() {
  while (true) {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Authenticate with Spotify', value: 'auth' },
            { name: 'Select WhatsApp chat', value: 'select-chat' },
            { name: 'Import tracks from WhatsApp', value: 'from-whatsapp' },
            { name: 'Import tracks from file', value: 'from-file' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      if (action === 'exit') {
        console.log('Goodbye! 👋');
        process.exit(0);
      }

      try {
        switch (action) {
          case 'auth':
            await handleAuth();
            break;
          case 'select-chat':
            await handleChatSelection();
            break;
          case 'from-whatsapp':
            await handleWhatsApp();
            break;
          case 'from-file':
            await handleFile();
            break;
        }
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: 'Would you like to try again?',
            default: true
          }
        ]);
        if (!retry) {
          continue;
        }
        // Retry the same action
        switch (action) {
          case 'auth':
            await handleAuth();
            break;
          case 'select-chat':
            await handleChatSelection();
            break;
          case 'from-whatsapp':
            await handleWhatsApp();
            break;
          case 'from-file':
            await handleFile();
            break;
        }
      }
    } catch (error) {
      console.error('\n❌ Fatal error:', error.message);
      process.exit(1);
    }
  }
}

async function validateSpotifyPlaylistId(playlistId) {
  if (!playlistId) return 'Playlist ID is required';
  if (!playlistId.match(/^[0-9A-Za-z]{22}$/)) {
    return 'Invalid Spotify playlist ID format. It should be 22 characters long and contain only letters and numbers.';
  }
  return true;
}

async function validateWhatsAppChatId(chatId) {
  if (!chatId) return 'Chat ID is required';
  // Basic WhatsApp chat ID format validation (group or individual)
  if (!chatId.match(/^[0-9]{10,}(@g\.us|@c\.us|@g\.us|@broadcast)$/)) {
    return 'Invalid WhatsApp chat ID format. It should end with @g.us, @c.us, or @broadcast';
  }
  return true;
}

async function reloadEnv() {
  // Reload environment variables from .env file
  const envConfig = dotenv.config();
  if (envConfig.error) {
    throw envConfig.error;
  }
  // Update process.env with new values
  for (const k in envConfig.parsed) {
    process.env[k] = envConfig.parsed[k];
  }
}

async function handleAuth() {
  return new Promise((resolve, reject) => {
    const spinner = ora('Starting Spotify authentication...').start();
    
    const envFilePath = '.env';
    const scope = 'playlist-modify-public playlist-modify-private playlist-read-private';
    
    const app = express();
    let server;
    
    app.get('/login', function (req, res) {
      function generateRandomString(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (var i = 0; i < length; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
      }
      const state = generateRandomString(16);
      res.redirect(
        'https://accounts.spotify.com/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID,
            scope: scope,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            state: state,
          }).toString(),
      );
    });
    
    app.get('/', async function (req, res) {
      const code = req.query.code;
    
      if (!code) {
        spinner.fail('Missing authorization code');
        res.status(500).send('Missing code for access token');
        server.close();
        reject(new Error('Missing code for access token'));
        return;
      }
    
      let accessToken;
      try {
        spinner.text = 'Exchanging authorization code for access token...';
        const response = await axios.post(
          'https://accounts.spotify.com/api/token',
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );
    
        accessToken = response.data.access_token;
      } catch (error) {
        spinner.fail('Failed to exchange code for access token');
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).send('Error exchanging code for access token');
        server.close();
        reject(error);
        return;
      }
    
      const newEnvContent = `SPOTIFY_ACCESS_TOKEN=${accessToken}`;
    
      try {
        spinner.text = 'Saving access token...';
        const data = fse.readFileSync(envFilePath, 'utf8');
        if (data.includes('SPOTIFY_ACCESS_TOKEN=')) {
          const updatedData = data.replace(/SPOTIFY_ACCESS_TOKEN=.*/g, newEnvContent);
          fse.outputFileSync(envFilePath, updatedData);
        } else {
          fse.appendFileSync(envFilePath, `\n${newEnvContent}`);
        }
        spinner.succeed('Access token saved successfully');
      } catch (err) {
        spinner.fail('Failed to save access token');
        console.error('Error details:', err.message);
        server.close();
        reject(err);
        return;
      }
    
      res.send(`
        <html>
          <body style="font-family: arial; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border: 1px solid lightgray; padding: 20px; border-radius: 10px; background-color: #ececec;">
              <h1>✅ Spotify access granted</h1>
              <h4>You can close this window now</h4>
            </div>
          </body>
        </html>
      `);
      res.end();
    
      server.close(() => {
        spinner.succeed('Authentication completed successfully! ✨\n');
        resolve();
      });
    });
    
    server = app.listen(3000, async () => {
      spinner.text = 'Opening browser for authentication...';
      await open('http://localhost:3000/login');
    });

    // Add server error handling
    server.on('error', (error) => {
      spinner.fail('Server error occurred');
      console.error('Error details:', error.message);
      reject(error);
    });
  });
}

async function handleChatSelection() {
  return new Promise(async (resolve, reject) => {
    const spinner = ora('Initializing WhatsApp client...').start();
    
    try {
      const client = new Client({
        authStrategy: new LocalAuth(),
      });

      client.once('ready', async () => {
        try {
          spinner.text = 'Fetching chats...';
          const chats = await client.getChats();
          await client.destroy();

          if (!chats.length) {
            spinner.info('No chats found');
            resolve();
            return;
          }

          spinner.stop();

          // Sort chats by name
          const sortedChats = chats.sort((a, b) => {
            const nameA = a.name || a.id.user;
            const nameB = b.name || b.id.user;
            return nameA.localeCompare(nameB);
          });

          // Create choices with chat details
          const choices = sortedChats.map(chat => ({
            name: `${chat.name || chat.id.user} ${chat.isGroup ? '(Group)' : '(Contact)'} - ID: ${chat.id.user}`,
            value: chat.id._serialized
          }));

          const { selectedChat } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedChat',
              message: 'Select a chat:',
              choices: [
                new inquirer.Separator('Groups'),
                ...choices.filter(c => c.name.includes('(Group)')),
                new inquirer.Separator('Contacts'),
                ...choices.filter(c => c.name.includes('(Contact)'))
              ],
              pageSize: 20
            }
          ]);

          // Copy to clipboard if possible
          try {
            await navigator.clipboard.writeText(selectedChat);
            console.log('\n✨ Chat ID copied to clipboard:', selectedChat);
          } catch {
            console.log('\n✨ Selected chat ID:', selectedChat);
          }

          // Save to .env if user wants
          const { saveToEnv } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'saveToEnv',
              message: 'Would you like to save this chat ID as default in .env?',
              default: true
            }
          ]);

          if (saveToEnv) {
            const envFilePath = '.env';
            const newEnvContent = `WHATSAPP_CHAT_ID=${selectedChat}`;

            try {
              const data = await fse.readFile(envFilePath, 'utf8');
              if (data.includes('WHATSAPP_CHAT_ID=')) {
                const updatedData = data.replace(/WHATSAPP_CHAT_ID=.*/g, newEnvContent);
                await fse.outputFile(envFilePath, updatedData);
              } else {
                await fse.appendFile(envFilePath, `\n${newEnvContent}`);
              }
              // Reload environment variables after saving
              await reloadEnv();
              console.log('✅ Chat ID saved as default in .env file');
            } catch (err) {
              console.error('❌ Error saving to .env:', err.message);
            }
          }

          resolve();
        } catch (error) {
          await client.destroy();
          spinner.fail('Error fetching chats');
          reject(error);
        }
      });

      client.on('qr', (qr) => {
        spinner.info('Scan this QR code with your phone:');
        qrcode.generate(qr, { small: true });
        spinner.start('Waiting for QR code scan...');
      });

      client.on('auth_failure', async (msg) => {
        spinner.fail('WhatsApp authentication failed');
        console.error('Error details:', msg);
        await client.destroy();
        reject(new Error('WhatsApp authentication failed'));
      });

      client.on('disconnected', async (reason) => {
        spinner.fail('WhatsApp client disconnected');
        console.error('Disconnection reason:', reason);
        await client.destroy();
        reject(new Error('WhatsApp client disconnected'));
      });

      client.initialize();
    } catch (error) {
      spinner.fail('Error occurred');
      reject(error);
    }
  });
}

async function handleWhatsApp() {
  return new Promise(async (resolve, reject) => {
    const spinner = ora();
    try {
      // Reload env variables to ensure we have the latest values
      await reloadEnv();
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'chatId',
          message: 'Enter the WhatsApp chat ID:',
          default: process.env.WHATSAPP_CHAT_ID || undefined,
          validate: validateWhatsAppChatId
        },
        {
          type: 'input',
          name: 'playlistId',
          message: 'Enter the Spotify playlist ID:',
          default: process.env.SPOTIFY_PLAYLIST_ID || undefined,
          validate: validateSpotifyPlaylistId
        },
        {
          type: 'confirm',
          name: 'fetchAll',
          message: 'Do you want to fetch all messages? (This might take a while)',
          default: true
        },
        {
          type: 'number',
          name: 'limit',
          message: 'How many messages to scan?',
          default: 1000,
          validate: value => value > 0 ? true : 'Please enter a number greater than 0',
          when: answers => !answers.fetchAll
        }
      ]);

      spinner.start('Initializing WhatsApp client...');
      
      const client = new Client({
        authStrategy: new LocalAuth(),
      });

      client.once('ready', async () => {
        try {
          spinner.text = 'Syncing message history for chat...';
          const chat = await client.getChatById(answers.chatId);

          if (!chat) {
            spinner.fail(`Chat ${answers.chatId} not found`);
            await client.destroy();
            reject(new Error(`Chat ${answers.chatId} not found`));
            return;
          }

          spinner.text = `Loading messages from chat ${chat.name}`;
          let allMessages = [];
          let currentPage = 1;
          const MESSAGES_PER_PAGE = 100;
          let hasMore = true;

          try {
            while (hasMore) {
              spinner.text = `Loading messages from chat ${chat.name} (page ${currentPage})`;
              
              const messages = await client.searchMessages('spotify', {
                page: currentPage,
                limit: MESSAGES_PER_PAGE,
                chatId: answers.chatId
              });
              
              if (!messages || messages.length === 0) {
                spinner.info('No more messages to load');
                break;
              }

              allMessages = [...allMessages, ...messages];

              // If we got fewer messages than requested, we've reached the end
              if (messages.length < MESSAGES_PER_PAGE) {
                break;
              }

              currentPage++;
              // Add a small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            spinner.succeed(`Finished loading messages (total: ${allMessages.length} messages)`);

            if (!allMessages.length) {
              spinner.info('No messages found');
              await client.destroy();
              resolve();
              return;
            }

            spinner.text = `Processing ${allMessages.length} messages...`;

            const trackIds = allMessages.reduce((acc, message) => {
              const match = spotifyTrackIdRegex.exec(message.body);

              if (!match?.[1]) {
                return acc;
              }

              return [...new Set(acc.concat(match[1]))];
            }, []);

            if (trackIds.length === 0) {
              spinner.info('No Spotify tracks found in messages');
              await client.destroy();
              resolve();
              return;
            }

            spinner.text = `Adding ${trackIds.length} tracks to playlist...`;
            await addTracksToPlaylist(answers.playlistId, trackIds);
            await client.destroy();
            spinner.succeed(`WhatsApp import completed successfully! ✨\nProcessed ${allMessages.length} messages and found ${trackIds.length} unique tracks.\n`);
            resolve();
          } catch (error) {
            spinner.fail('Error during WhatsApp import');
            await client.destroy();
            reject(error);
          }
        } catch (error) {
          spinner.fail('Error during WhatsApp import');
          await client.destroy();
          reject(error);
        }
      });

      client.on('qr', (qr) => {
        spinner.info('Scan this QR code with your phone:');
        qrcode.generate(qr, { small: true });
        spinner.start('Waiting for QR code scan...');
      });

      client.on('auth_failure', async (msg) => {
        spinner.fail('WhatsApp authentication failed');
        console.error('Error details:', msg);
        await client.destroy();
        reject(new Error('WhatsApp authentication failed'));
      });

      client.on('disconnected', async (reason) => {
        spinner.fail('WhatsApp client disconnected');
        console.error('Disconnection reason:', reason);
        await client.destroy();
        reject(new Error('WhatsApp client disconnected'));
      });

      client.initialize();
    } catch (error) {
      spinner.fail('Error occurred');
      reject(error);
    }
  });
}

async function handleFile() {
  const spinner = ora();
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'file',
        message: 'Enter the path to the file containing Spotify track URLs:',
        default: process.env.DATA_FILE || undefined,
        validate: async (input) => {
          if (!input) return 'File path is required';
          try {
            await fse.access(input);
            return true;
          } catch {
            return 'File does not exist or is not accessible';
          }
        }
      },
      {
        type: 'input',
        name: 'playlistId',
        message: 'Enter the Spotify playlist ID:',
        default: process.env.SPOTIFY_PLAYLIST_ID || undefined,
        validate: validateSpotifyPlaylistId
      }
    ]);

    spinner.start(`Scanning ${answers.file} for track IDs...`);
    const spotifyTrackURIs = await extractSpotifyTracksFromFile(answers.file);

    if (spotifyTrackURIs.length === 0) {
      spinner.info('No Spotify tracks found in file');
      return;
    }

    spinner.text = `Adding ${spotifyTrackURIs.length} tracks to playlist...`;
    await addTracksToPlaylist(answers.playlistId, spotifyTrackURIs);
    spinner.succeed('File import completed successfully! ✨\n');
  } catch (error) {
    spinner.fail('Error during file import');
    throw error;
  }
}

program.parse(); 