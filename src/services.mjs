import 'dotenv/config';
import fse from 'fs-extra';
import SpotifyWebApi from 'spotify-web-api-node';

const BATCH_SIZE = 100;

const client = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

client.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);

export async function extractSpotifyTracksFromFile(filePath) {
  console.log(`Start extracting trackIds from ${filePath}`);

  const data = await fse.readFile(filePath, 'utf-8');
  const spotifyTrackIDs = data.match(/(?<=track\/)([a-zA-Z0-9]{22})/g) || [];
  const spotifyTrackURIs = [...new Set(spotifyTrackIDs)];

  console.log(`Found ${spotifyTrackURIs.length} trackIds`);

  return spotifyTrackURIs;
}

export async function getPlaylistTrackIds(playlistId) {
  let allTrackIds = [];
  let offset = 0;
  let totalTracks = 1;
  console.log(`Getting trackIds from playlist ${playlistId}`);

  while (offset < totalTracks) {
    const response = await client.getPlaylistTracks(playlistId, {
      fields: 'items(track(id)), total',
      offset: offset,
      limit: 100,
    });

    totalTracks = response.body.total;
    const trackIds = response.body.items.map((item) => item.track.id);
    allTrackIds = allTrackIds.concat(trackIds);
    offset += 100;
  }
  console.log(`Found ${allTrackIds.length} tracks in the playlist.`);

  return allTrackIds;
}

export async function addTracksToSpotify(playlistId, trackUris) {
  console.log(`Adding ${trackUris.length} tracks to playlist ${playlistId}`);
  try {
    await client.addTracksToPlaylist(
      playlistId,
      trackUris,
    );
    console.log(`Added ${trackUris.length} tracks to the playlist.`);
  } catch (error) {
    console.error(
      'Error adding tracks in batch:',
      error.response ? error.response.data : error.message,
    );
  }
}

export async function addTracksToPlaylist(playlistId, trackUris) {
  const existingTrackIds = await getPlaylistTrackIds(playlistId);
  const newTrackUris = trackUris.filter((id) => !existingTrackIds.includes(id));
  console.log(`Found ${newTrackUris.length} new tracks to add`);

  try {
    let processed = 0;
    for (let i = 0; i < newTrackUris.length; i += BATCH_SIZE) {
      const batch = newTrackUris
        .slice(i, i + BATCH_SIZE)
        .map((id) => `spotify:track:${id}`);
      if (batch.length > 0) {
        await addTracksToSpotify(playlistId, batch);
        processed += batch.length;
      }
    }

    if (processed > 0) {
      console.log(`Successfully added ${processed} tracks to the playlist.`);
    } else {
      console.log('No new tracks to add.');
    }
  } catch (error) {
    console.error('Error adding tracks to playlist:', error);
  }
}
