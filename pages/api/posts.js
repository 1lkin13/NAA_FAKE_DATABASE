import fs from 'fs';
import path from 'path';

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
    console.error('Failed to read posts JSON', error);
    return [];
  }
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const posts = readPosts();
  return res.status(200).json(posts);
}


