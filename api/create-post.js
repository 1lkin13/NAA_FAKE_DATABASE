import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { uploadFilesToUploadThing } from '../lib/uploadthing-server.js';

const filePath = path.join(process.cwd(), 'mock_data_production.json');

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const form = formidable({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Parse error' });
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
        const paths = galleryFiles.map((f) => f.filepath).filter(Boolean);
        galleryImageUrls = await uploadFilesToUploadThing(paths, 'imageUploader');
      }

      const newPost = {
        id: Date.now().toString(),
        title: fields.title?.[0] || fields.title,
        slug: fields.slug?.[0] || fields.slug,
        category: fields.category?.[0] || fields.category,
        htmlContent: fields.htmlContent?.[0] || fields.htmlContent,
        language: fields.language?.[0] || fields.language,
        coverImage: coverImageUrl || '',
        galleryImages: galleryImageUrls,
        createdAt: new Date().toISOString(),
      };

      let posts = [];
      if (fs.existsSync(filePath)) {
        posts = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      posts.push(newPost);
      fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));

      res.status(201).json(newPost);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });
}


