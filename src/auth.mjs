import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import open from 'open';
import fse from 'fs-extra';
import { URLSearchParams } from 'url';

const envFilePath = '.env';
const scope =
  'playlist-modify-public playlist-modify-private playlist-read-private';

var app = express();


app.get('/login', function (req, res) {
  function generateRandomString(length) {
    let result = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
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
    res.status(500).send('Missing code for access token');
    process.exit(1);
  }

  let accessToken;
  try {
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
    console.error('Error exchanging code for access token:', error);
    res.status(500).send('Error exchanging code for access token');
    process.exit(1);
  }

  const newEnvContent = `SPOTIFY_ACCESS_TOKEN=${accessToken}`;

  try {
    const data = fse.readFileSync(envFilePath, 'utf8');
    if (data.includes('SPOTIFY_ACCESS_TOKEN=')) {
      const updatedData = data.replace(
        /SPOTIFY_ACCESS_TOKEN=.*/g,
        newEnvContent,
      );
      fse.outputFileSync(envFilePath, updatedData);
      console.log('Access token written to .env file');
    } else {
      fse.appendFileSync(envFilePath, `\n${newEnvContent}`);
      console.log('Access token appended to .env file');
    }
  } catch (err) {
    console.error('Error reading or writing to .env file:', err);
    process.exit(1);
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
    console.log('Server shutdown after receiving access token');
    process.exit(0);
  });
});

const server = app.listen(3000, async () => {
  console.log('Server is running on port 3000');
  await open('http://localhost:3000/login');
});
