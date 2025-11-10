const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { uploadFilesToUploadThing } = require('../lib/uploadthing-server');

const SEED_FILE = path.join(process.cwd(), 'mock.data.production.json');
const TMP_FILE = path.join('/tmp', 'mock_data_production.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const form = formidable({ multiples: true, keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'File parse error' });
    }
    try {
      const cover = Array.isArray(files.coverImage) ? files.coverImage[0] : files.coverImage;
      const gallery =
        Array.isArray(files.galleryImages) ? files.galleryImages : files.galleryImages ? [files.galleryImages] : [];

      let coverUrl = '';
      let galleryUrls = [];

      if (cover?.filepath) {
        const [u] = await uploadFilesToUploadThing([cover.filepath], 'imageUploader');
        coverUrl = u || '';
      }
      if (gallery && gallery.length > 0) {
        const paths = gallery.map((f) => f.filepath).filter(Boolean);
        if (paths.length) {
          galleryUrls = await uploadFilesToUploadThing(paths, 'imageUploader');
        }
      }

      const newPost = {
        id: Date.now().toString(),
        title: Array.isArray(fields.title) ? fields.title[0] : fields.title,
        slug: Array.isArray(fields.slug) ? fields.slug[0] : fields.slug,
        category: Array.isArray(fields.category) ? fields.category[0] : fields.category,
        htmlContent: Array.isArray(fields.htmlContent) ? fields.htmlContent[0] : fields.htmlContent,
        language: Array.isArray(fields.language) ? fields.language[0] : fields.language,
        coverImage: coverUrl,
        galleryImages: galleryUrls,
        createdAt: new Date().toISOString(),
        author: 'admin',
        status: 'Active',
        publishStatus: 'Publish',
      };

      let posts = [];
      try {
        if (fs.existsSync(TMP_FILE)) {
          posts = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
        } else if (fs.existsSync(SEED_FILE)) {
          posts = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
        }
      } catch {}

      posts.unshift(newPost);
      fs.writeFileSync(TMP_FILE, JSON.stringify(posts, null, 2));

      return res.status(201).json(newPost);
    } catch (e) {
      console.error('Create post error:', e);
      return res.status(500).json({ error: e.message || 'Upload failed' });
    }
  });
};


