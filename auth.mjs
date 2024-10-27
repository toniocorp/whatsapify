import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import querystring from 'querystring';
import open from 'open';
import fse from 'fs-extra';

const envFilePath = '.env';
const scope =
  'playlist-modify-public playlist-modify-private playlist-read-private';

var app = express();

const server = app.listen(3000, async () => {
  console.log('Server is running on port 3000');
  await open('http://localhost:3000/login');
});

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
      querystring.stringify({
        response_type: 'code',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        state: state,
      }),
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
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    accessToken = response.data.access_token;
  } catch (error) {
    console.error('Error exchanging code for access token:', error);
    res.status(500).send('Error exchanging code for access token'); // Handle errors
    process.exit(1);
  }

  const newEnvContent = `\nSPOTIFY_ACCESS_TOKEN=${accessToken}`;

  try {
    const data = fse.readFileSync(envFilePath, 'utf8');
    // Check if SPOTIFY_ACCESS_TOKEN already exists
    if (data.includes('SPOTIFY_ACCESS_TOKEN=')) {
      // Replace the existing token
      const updatedData = data.replace(
        /SPOTIFY_ACCESS_TOKEN=.*/g,
        newEnvContent,
      );
      fse.outputFileSync(envFilePath, updatedData);
      console.log('Access token written to .env file');
    } else {
      // Append the new token if it doesn't exist
      fse.appendFileSync(envFilePath, newEnvContent);
      console.log('Access token appended to .env file');
    }
  } catch (err) {
    console.error('Error reading or writing to .env file:', err);
    process.exit(1);
  }

  res.send(
    `<h1 style="font-family: arial;">👍 Access token written to .env file</h1><h4>You can close this window now</h4>`,
  );

  server.close(() => {
    console.log('Server shutdown after receiving access token');
    process.exit(0);
  });
});
