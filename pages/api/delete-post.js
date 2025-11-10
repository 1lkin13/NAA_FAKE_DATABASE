import fs from 'fs';
import path from 'path';
import { deleteFilesFromUploadThing } from '../../lib/uploadthing-server.js';

const SEED_DB_PATH = path.join(process.cwd(), 'mock_data_production.json');
const TMP_DB_PATH = path.join('/tmp', 'mock_data_production.json');

const readPosts = () => {
  const sourcePath = fs.existsSync(TMP_DB_PATH) ? TMP_DB_PATH : SEED_DB_PATH;
  if (!fs.existsSync(sourcePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(sourcePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse posts JSON', error);
    return [];
  }
};

const writePosts = (posts) => {
  const dir = path.dirname(TMP_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TMP_DB_PATH, JSON.stringify(posts, null, 2));
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    const posts = readPosts();
    const postIndex = posts.findIndex(post => String(post.id) === String(id));

    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postToDelete = posts[postIndex];

    // UploadThing'den bu post'a ait tüm dosyaları sil
    deleteFilesFromUploadThing(String(id));

    // Post'u array'den kaldır
    posts.splice(postIndex, 1);
    writePosts(posts);

    console.log('Post deleted successfully:', { id, title: postToDelete.title });
    return res.status(200).json({ message: 'Post deleted successfully', deletedPost: postToDelete });

  } catch (error) {
    console.error('delete-post error', error);
    return res.status(500).json({ error: error.message || 'Unexpected error' });
  }
}
