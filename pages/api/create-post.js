import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { uploadFilesToUploadThing } from '../../lib/uploadthing-server.js';

export const config = { api: { bodyParser: false } };

const SEED_DB_PATH = path.join(process.cwd(), 'mock_data_production.json');
const TMP_DB_PATH = path.join('/tmp', 'mock_data_production.json');

const ensureDirectory = () => {
  const dir = path.dirname(TMP_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

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
  ensureDirectory();
  fs.writeFileSync(TMP_DB_PATH, JSON.stringify(posts, null, 2));
};

const getFieldValue = (value) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const form = formidable({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('formidable parse error', err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    try {
      const coverFile = Array.isArray(files.coverImage) ? files.coverImage[0] : files.coverImage;
      const galleryFiles = Array.isArray(files.galleryImages)
        ? files.galleryImages
        : files.galleryImages
        ? [files.galleryImages]
        : [];

      let coverImageUrl = '';
      let galleryImageUrls = [];

      if (coverFile?.filepath) {
        [coverImageUrl] = await uploadFilesToUploadThing([coverFile.filepath], 'imageUploader');
      }

      if (galleryFiles.length > 0) {
        const paths = galleryFiles.map((file) => file.filepath).filter(Boolean);
        if (paths.length > 0) {
          galleryImageUrls = await uploadFilesToUploadThing(paths, 'imageUploader');
        }
      }

      const newPost = {
        id: Date.now().toString(),
        title: getFieldValue(fields.title),
        slug: getFieldValue(fields.slug),
        category: getFieldValue(fields.category),
        htmlContent: getFieldValue(fields.htmlContent),
        language: getFieldValue(fields.language) || 'AZ',
        coverImage: coverImageUrl || '',
        galleryImages: galleryImageUrls,
        createdAt: new Date().toISOString(),
        author: 'admin',
        status: 'Active',
        publishStatus: 'Publish',
      };

      const posts = readPosts();
      posts.unshift(newPost);
      writePosts(posts);

      return res.status(201).json(newPost);
    } catch (error) {
      console.error('create-post error', error);
      return res.status(500).json({ error: error.message || 'Unexpected error' });
    }
  });
}


