import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PugongyingClient } from '../src/ingestion/pugongying-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const client = new PugongyingClient({
    noteBaseUrl: process.env.PUGONGYING_NOTE_BASE_URL || '',
    commentBaseUrl: process.env.PUGONGYING_COMMENT_BASE_URL || '',
    apiKey: process.env.PUGONGYING_API_KEY || '',
  });

  const noteIds = ['6a0c0fc3000000003601f68b'];
  console.log('采集媒体...');
  const media = await client.fetchNoteMedia(noteIds);

  for (const [noteId, m] of Object.entries(media)) {
    console.log(`\n${noteId}:`);
    console.log('  coverImages:', m.coverImages.length, m.coverImages);
    console.log('  videoPath:', m.videoPath);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
