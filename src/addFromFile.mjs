import 'dotenv/config';
import { extractSpotifyTracksFromFile, addTracksToPlaylist } from './services.mjs';

(async () => {
  console.log(`Scanning ${process.env.DATA_FILE} for trackIds`);
  const spotifyTrackURIs = await extractSpotifyTracksFromFile(process.env.DATA_FILE);
  console.log(`Adding ${spotifyTrackURIs.length} tracks to ${process.env.SPOTIFY_PLAYLIST_ID}`);
  await addTracksToPlaylist(process.env.SPOTIFY_PLAYLIST_ID, spotifyTrackURIs);
  process.exit(0);
})();
