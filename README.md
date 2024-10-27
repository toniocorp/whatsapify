# Spotify playlist updater

## Overview

This project provides a node command-line tool to update your Spotify playlists with the content of a file or by searching a whatsapp channel.

## Features

- Extracts Spotify track IDs from whatsapp channel
- Extracts Spotify tracks from a text file
- Checks existing playlist for duplicates, only new tracks are added

## Quickstart

```bash
pnpm i

# Fill your spotify credentials in .env
cp .env.template .env

# Authenticate to spotify
pnpm auth
# Loads tracks from whatsapp channel search
pnpm from-whatsapp
# Loads tracks from data file
pnpm from-file
```

> [!NOTE] 
> You need node to run this project, use the package manager of your taste

## Spotify authentication

You need 
- a Spotify account
- a Spotify app: You can follow the [official guide](https://developer.spotify.com/documentation/web-api/tutorials/getting-started#create-an-app) to create an app and get your Spotify credentials from the dashboard.
- a playlist id: Copy the share link of the spotify playlist, the ID is the segment that follows the "playlist" argument in the URL (e.g., `https://open.spotify.com/playlist/3JOifD0AGqnfwpyv6BN8mj?si=71551b92cc95402d`).

> [!TIP] 
> The auth server is configured to use `http://localhost:3000` as redirect url, use the same value in your Spotify app

## Whatsapp authentication

When the script asks for authentication with a QR code, use the Whatsapp application on your phone to add a linked device. 
