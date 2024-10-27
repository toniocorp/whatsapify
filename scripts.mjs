import 'dotenv/config';
import fse from 'fs-extra';
import SpotifyWebApi from 'spotify-web-api-node';

const INPUT_FILE = './data.txt';
const BATCH_SIZE = 100;

const client = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

client.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);

async function extractSpotifyTracks() {
  console.log('Start extracting Spotify uris');

  const data = await fse.readFile(INPUT_FILE, 'utf-8');

  console.log('Data read');
  const spotifyTrackIDs = data.match(/(?<=track\/)([a-zA-Z0-9]{22})/g) || [];

  const spotifyTrackURIs = [...new Set(spotifyTrackIDs)];

  console.log('Spotify uris extracted');
  return spotifyTrackURIs;
}

async function getPlaylistTrackIds() {
  let allTrackIds = [];
  let offset = 0;
  let totalTracks = 1; 

  while (offset < totalTracks) {
    const response = await client.getPlaylistTracks(process.env.SPOTIFY_PLAYLIST_ID, {
      fields: 'items(track(id)), total',
      offset: offset,
      limit: 100,
    });

    totalTracks = response.body.total; // Get total number of tracks
    const trackIds = response.body.items.map(item => item.track.id);
    allTrackIds = allTrackIds.concat(trackIds);
    offset += 100; 
  }

  return allTrackIds;
}

async function addTracksToSpotify(trackUris) {
  try {
    await client.addTracksToPlaylist(process.env.SPOTIFY_PLAYLIST_ID, trackUris);
    console.log(`Added ${trackUris.length} tracks to the playlist.`);
  } catch (error) {
    console.error(
      'Error adding tracks in batch:',
      error.response ? error.response.data : error.message,
    );
  }
}

async function addTracksToPlaylist(trackUris) {
  const existingTrackIds = await getPlaylistTrackIds();
  console.log(`Found ${existingTrackIds.length} tracks in the playlist.`);
  
  try {
    let processed = 0;
    for (let i = 0; i < trackUris.length; i += BATCH_SIZE) {
      const batch = trackUris
        .slice(i, i + BATCH_SIZE)
        .filter((id) => !existingTrackIds.includes(id))
        .map((id) => `spotify:track:${id}`);
      if (batch.length > 0) {
        await addTracksToSpotify(batch);
        processed += batch.length;
      }
    }

    console.log(`Successfully added ${processed} tracks to the playlist.`);
  } catch (error) {
    console.error('Error adding tracks to playlist:', error);
  }
}

(async () => {
  const spotifyTrackURIs = await extractSpotifyTracks();
  await addTracksToPlaylist(spotifyTrackURIs);
  process.exit(0);
})();
