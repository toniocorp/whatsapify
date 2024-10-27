# Spotify Link Extractor

## Overview
The Spotify Link Extractor is a simple JavaScript application that extracts track IDs from Spotify links found in a given text file.

## Features
- Extracts Spotify track IDs from text data.
- Supports both HTTP and HTTPS links.
- Utilizes regular expressions for efficient extraction.
- Only adds tracks that are not already in the playlist

## Installation
```bash
git clone https://github.com/toniocorp/whatsapify.git
pnpm i
```

## Prerequisite
You need a spotify account, a Spotify app and a playlist reday to receive the tracks.
Refer to [this guide](https://developer.spotify.com/documentation/web-api/concepts/apps) to create the app and get your Spotify credentials (`client_id`, `client_secret` and `redirect_url`).

> [!TIP] 
> The auth server is configured to use `http://localhost:3000` as redirect url, if you don't use that in your Spotify app, update accordingly

Get the playlist id by creating it in spotify UI and retrieve the share link, the id is the chain following the playlist arg (i.e. https://open.spotify.com/playlist/**3JOiQD0xGqncwpyv6BN8mj**?si=71444b92cc95402d)

## Usage
1. Create your `.env` file by running `cp .env.template .env`, fill it with your credentials
2. Run `pnpm auth` and complete the spotify authentication
3. Put all the text from which you want to get the tracks from in `data.txt`
4. Run `pnpm upload`
5. That's it, tracks should be available in your playlist 🎉
