import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { uploadFilesToUploadThing, deleteFilesFromUploadThing } from '../../lib/uploadthing-server.js';

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
      const action = getFieldValue(fields.action);
      const existingId = getFieldValue(fields.existingId);

      if (action === 'delete') {
        if (!existingId) {
          return res.status(400).json({ error: 'existingId is required for delete action' });
        }

        const posts = readPosts();
        const deleteIndex = posts.findIndex((post) => String(post.id) === String(existingId));

        if (deleteIndex === -1) {
          return res.status(404).json({ error: 'Post not found' });
        }

        const postToDelete = posts[deleteIndex];

        try {
          await deleteFilesFromUploadThing(String(existingId));
        } catch (deleteError) {
          console.warn('Failed to delete files from UploadThing for post', existingId, deleteError);
        }

        posts.splice(deleteIndex, 1);
        writePosts(posts);

        return res.status(200).json({ message: 'Post deleted successfully', deletedPost: postToDelete });
      }

      const coverFile = Array.isArray(files.coverImage) ? files.coverImage[0] : files.coverImage;
      const galleryFiles = Array.isArray(files.galleryImages)
        ? files.galleryImages
        : files.galleryImages
        ? [files.galleryImages]
        : [];

      const existingCoverImageUrl = getFieldValue(fields.coverImageUrl) || '';
      const existingGalleryUrls = toArray(
        fields['galleryImageUrls[]'] ?? fields.galleryImageUrls ?? fields.existingGalleryImages
      ).map((item) => String(item));

      let coverImageUrl = '';
      let galleryImageUrls = [];

      const postId = existingId || Date.now().toString();

      if (coverFile?.filepath) {
        [coverImageUrl] = await uploadFilesToUploadThing([coverFile.filepath], 'imageUploader', postId);
      }

      if (galleryFiles.length > 0) {
        const paths = galleryFiles.map((file) => file.filepath).filter(Boolean);
        if (paths.length > 0) {
          galleryImageUrls = await uploadFilesToUploadThing(paths, 'imageUploader', postId);
        }
      }

      const finalCoverImage = coverImageUrl || existingCoverImageUrl || '';
      const finalGalleryImages = galleryImageUrls.length > 0 ? galleryImageUrls : existingGalleryUrls;
      const categoryValue = getFieldValue(fields.category) || 'News';
      const normalizedType = categoryValue === 'Announcement' ? 'Announcement' : 'News';

      const newPost = {
        title: getFieldValue(fields.title),
        slug: getFieldValue(fields.slug),
        category: categoryValue,
        type: normalizedType,
        htmlContent: getFieldValue(fields.htmlContent),
        language: getFieldValue(fields.language) || 'AZ',
        coverImage: finalCoverImage,
        galleryImages: finalGalleryImages,
        author: 'admin',
        status: 'Active',
        publishStatus: 'Publish',
      };

      const posts = readPosts();
      let responsePost;

      if (existingId) {
        const index = posts.findIndex((post) => String(post.id) === String(existingId));
        if (index !== -1) {
          const previous = posts[index];
          responsePost = {
            ...previous,
            ...newPost,
            id: String(existingId),
            createdAt: previous.createdAt || new Date().toISOString(),
          };
          posts[index] = responsePost;
        } else {
          responsePost = {
            ...newPost,
            id: String(existingId),
            createdAt: new Date().toISOString(),
          };
          posts.unshift(responsePost);
        }
        writePosts(posts);
        return res.status(200).json(responsePost);
      } else {
        responsePost = {
          ...newPost,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        };
        posts.unshift(responsePost);
        writePosts(posts);
        return res.status(201).json(responsePost);
      }

    } catch (error) {
      console.error('create-post error', error);
      return res.status(500).json({ error: error.message || 'Unexpected error' });
    }
  });
}


