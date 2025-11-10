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

const toArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  const form = formidable({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('formidable parse error', err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    try {
      const posts = readPosts();
      const postIndex = posts.findIndex(post => String(post.id) === String(id));

      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const existingPost = posts[postIndex];

      const coverFile = Array.isArray(files.coverImage) ? files.coverImage[0] : files.coverImage;
      const galleryFiles = Array.isArray(files.galleryImages)
        ? files.galleryImages
        : files.galleryImages
        ? [files.galleryImages]
        : [];

      const existingCoverImageUrl = getFieldValue(fields.coverImageUrl) || existingPost.coverImage || '';
      const existingGalleryUrls = toArray(
        fields['galleryImageUrls[]'] ?? fields.galleryImageUrls ?? fields.existingGalleryImages
      ).map((item) => String(item));

      let coverImageUrl = '';
      let galleryImageUrls = [];

      if (coverFile?.filepath) {
        [coverImageUrl] = await uploadFilesToUploadThing([coverFile.filepath], 'imageUploader', String(id));
      }

      if (galleryFiles.length > 0) {
        const paths = galleryFiles.map((file) => file.filepath).filter(Boolean);
        if (paths.length > 0) {
          galleryImageUrls = await uploadFilesToUploadThing(paths, 'imageUploader', String(id));
        }
      }

      const finalCoverImage = coverImageUrl || existingCoverImageUrl || '';
      const finalGalleryImages = galleryImageUrls.length > 0 ? galleryImageUrls : existingGalleryUrls;
      const categoryValue = getFieldValue(fields.category) || existingPost.category || 'News';
      const normalizedType = categoryValue === 'Announcement' ? 'Announcement' : 'News';

      const updatedPost = {
        ...existingPost,
        title: getFieldValue(fields.title) || existingPost.title,
        slug: getFieldValue(fields.slug) || existingPost.slug,
        category: categoryValue,
        type: normalizedType,
        htmlContent: getFieldValue(fields.htmlContent) || existingPost.htmlContent,
        language: getFieldValue(fields.language) || existingPost.language || 'AZ',
        coverImage: finalCoverImage,
        galleryImages: finalGalleryImages,
        status: getFieldValue(fields.status) || existingPost.status || 'Active',
        publishStatus: getFieldValue(fields.publishStatus) || existingPost.publishStatus || 'Publish',
        updatedAt: new Date().toISOString(),
      };

      posts[postIndex] = updatedPost;
      writePosts(posts);

      console.log('Post updated successfully:', { id, title: updatedPost.title });
      return res.status(200).json(updatedPost);

    } catch (error) {
      console.error('update-post error', error);
      return res.status(500).json({ error: error.message || 'Unexpected error' });
    }
  });
}
