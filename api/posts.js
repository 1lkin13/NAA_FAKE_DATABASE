const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(process.cwd(), 'mock.data.production.json');
const TMP_FILE = path.join('/tmp', 'mock_data_production.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    let source = TMP_FILE;
    if (!fs.existsSync(TMP_FILE)) {
      source = SEED_FILE;
    }
    const data = fs.readFileSync(source, 'utf-8');
    const posts = JSON.parse(data);
    res.status(200).json(posts);
  } catch (e) {
    res.status(200).json([]);
  }
};

// Vercel Serverless Function - GET, POST, PUT, DELETE posts
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'mock.data.production.json');
const FILES_DIR = join(process.cwd(), 'public', 'files');

function loadData() {
  try {
    const data = readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { posts: [], total: 0 };
  }
}

function saveData(data) {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

const stripHtml = (html = '') => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const createDescription = (html = '') => {
  const plain = stripHtml(html);
  return plain.length > 160 ? `${plain.slice(0, 160)}...` : plain;
};
const formatSharingDate = (date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatSharingHour = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
const normalizeCategory = (category) => (category === 'Announcement' ? 'Announcement' : 'News');

const normalizeGallery = (gallery) => {
  if (!gallery && gallery !== '') {
    return [];
  }
  if (Array.isArray(gallery)) {
    return gallery.filter(Boolean);
  }
  if (typeof gallery === 'string') {
    const trimmed = gallery.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (error) {
      // fall through
    }
    return [trimmed];
  }
  return [];
};

const ensureFilesDir = () => {
  mkdirSync(FILES_DIR, { recursive: true });
};

// For JSON-only mode, if a base64 is sent, convert and persist locally (dev only)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const saveBase64Image = (imageData) => {
  if (typeof imageData !== 'string') return imageData;
  if (!imageData.startsWith('data:image/')) return imageData;
  const [metadata, dataPart] = imageData.split(';base64,');
  if (!dataPart) return imageData;
  const mimeType = metadata.replace(/^data:/, '') || 'image/png';
  const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';
  const buffer = Buffer.from(dataPart.replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_SIZE) return imageData;
  ensureFilesDir();
  const filename = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
  const filepath = join(FILES_DIR, filename);
  writeFileSync(filepath, buffer);
  return `/files/${filename}`;
};
const processGalleryInput = (gallery) => {
  const normalized = normalizeGallery(gallery);
  if (!normalized.length) return [];
  return normalized.map((g) => saveBase64Image(g));
};

const normalizeFieldName = (name = '') => name.replace(/\[\d+\]$/, '');

const parseMultipartForm = (req) =>
  new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const files = {};

    busboy.on('field', (name, value) => {
      const normalized = normalizeFieldName(name);
      if (Object.prototype.hasOwnProperty.call(fields, normalized)) {
        const current = fields[normalized];
        if (Array.isArray(current)) {
          current.push(value);
        } else {
          fields[normalized] = [current, value];
        }
      } else {
        fields[normalized] = value;
      }
    });

    busboy.on('file', (name, file, info) => {
      const normalized = normalizeFieldName(name);
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('error', (error) => reject(error));
      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (!files[normalized]) {
          files[normalized] = [];
        }
        files[normalized].push({
          buffer,
          filename: info?.filename || `upload-${Date.now()}`,
          mimeType: info?.mimeType || 'application/octet-stream',
        });
      });
    });

    busboy.on('error', (error) => reject(error));
    busboy.on('finish', () => resolve({ fields, files }));

    req.pipe(busboy);
  });

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const getFieldValue = (formFields, jsonFields, key) => {
  if (hasOwn(formFields, key)) {
    const value = formFields[key];
    return Array.isArray(value) ? value[value.length - 1] : value;
  }
  if (hasOwn(jsonFields, key)) {
    const value = jsonFields[key];
    return Array.isArray(value) ? value[value.length - 1] : value;
  }
  return undefined;
};

const getFieldValues = (formFields, jsonFields, key) => {
  if (hasOwn(formFields, key)) {
    const value = formFields[key];
    return Array.isArray(value) ? value : [value];
  }
  if (hasOwn(jsonFields, key)) {
    const value = jsonFields[key];
    return Array.isArray(value) ? value : [value];
  }
  return [];
};

const parseJSONField = (formFields, jsonFields, key, fallback = []) => {
  const rawValue = getFieldValue(formFields, jsonFields, key);
  if (!rawValue) return Array.isArray(fallback) ? [...fallback] : fallback;
  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : Array.isArray(fallback) ? [...fallback] : fallback;
  } catch {
    return Array.isArray(fallback) ? [...fallback] : fallback;
  }
};

const getFileExtension = (filename = '', mimeType = '') => {
  const nameExt = filename.split('.').pop();
  if (nameExt && nameExt !== filename) {
    return nameExt.toLowerCase();
  }
  if (mimeType && mimeType.includes('/')) {
    return mimeType.split('/')[1]?.split('+')[0] || 'bin';
  }
  return 'bin';
};

const createSafeFilename = (filename = '', mimeType = '') => {
  const extension = getFileExtension(filename, mimeType) || 'bin';
  return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
};

const parseRequestBody = (rawBody) => {
  if (!rawBody) {
    return {};
  }
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return {};
    }
  }
  return rawBody;
};

export default async function handler(req, res) {
  // CORS headers - Allow all origins and methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  const data = loadData();
  const { method, query, body: rawBody } = req;
  const jsonPayload = parseRequestBody(rawBody);

  // Extract post ID from URL path or query
  let postId = null;
  if (req.url) {
    const urlMatch = req.url.match(/\/api\/posts\/([^/?]+)/);
    if (urlMatch) {
      postId = urlMatch[1];
    }
  }
  postId = postId || query.id || (query.posts && query.posts[0]);

  // GET /api/posts
  if (method === 'GET' && !postId) {
    let posts = [...data.posts];

    if (query.type && query.type !== 'All Posts') {
      posts = posts.filter((post) => post.type === normalizeCategory(query.type));
    }

    if (query.status && query.status !== 'All Status') {
      posts = posts.filter((post) => post.status === query.status);
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchLower) ||
          (post.description || '').toLowerCase().includes(searchLower) ||
          (post.author || '').toLowerCase().includes(searchLower)
      );
    }

    posts.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    const page = parseInt(query.page || '1', 10);
    const itemsPerPage = parseInt(query.itemsPerPage || '10', 10);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    return res.status(200).json({
      posts: paginatedPosts,
      total: posts.length,
    });
  }

  // GET /api/posts/:id
  if (method === 'GET' && postId) {
    const post = data.posts.find((p) => p.id === postId);
    if (post) {
      return res.status(200).json(post);
    }
    return res.status(404).json({ error: 'Post not found' });
  }

  // Handle PUT and DELETE with ID from URL
  if ((method === 'PUT' || method === 'DELETE') && !postId) {
    if (req.url) {
      const urlMatch = req.url.match(/\/api\/posts\/([^/?]+)/);
      if (urlMatch) {
        postId = urlMatch[1];
      }
    }
  }

  // POST /api/posts
  if (method === 'POST') {
    const {
      title = '',
      slug = null,
      category,
      htmlContent = '',
      language,
      status,
      publishStatus,
      author,
      coverImage,
      galleryImages,
    } = jsonPayload || {};

    if (!title || !htmlContent) {
      return res.status(400).json({ error: 'Title is required' });
    }
    let coverImagePath = coverImage || '';
    if (coverImagePath.startsWith('data:image/')) {
      coverImagePath = saveBase64Image(coverImagePath);
    }
    if (!coverImagePath) {
      return res.status(400).json({ error: 'Cover image is required' });
    }

    let galleryPaths = processGalleryInput(galleryImages);
    galleryPaths = [...new Set((galleryPaths || []).filter(Boolean))];

    const now = new Date();
    const newPost = {
      id: `prod-${Date.now()}`,
      title: String(title),
      slug,
      image: coverImagePath,
      description: createDescription(String(htmlContent)),
      htmlContent: String(htmlContent),
      type: normalizeCategory(category || 'News'),
      sharingTime: formatSharingDate(now),
      sharingHour: formatSharingHour(now),
      status: status || 'Active',
      publishStatus: publishStatus || 'Publish',
      author: author || 'admin',
      createdAt: now.toISOString(),
      language: language || 'AZ',
    };

    if (galleryPaths.length > 0) {
      newPost.galleryImages = galleryPaths;
    }

    data.posts.unshift(newPost);
    data.total = data.posts.length;

    if (saveData(data)) {
      return res.status(201).json(newPost);
    }
    return res.status(500).json({ error: 'Failed to save post' });
  }

  // PUT /api/posts/:id
  if (method === 'PUT' && postId) {
    const index = data.posts.findIndex((p) => p.id === postId);
    if (index === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingPost = data.posts[index];
    const {
      title,
      slug,
      category,
      htmlContent,
      language,
      status,
      publishStatus,
      author,
      coverImage,
      galleryImages,
    } = jsonPayload || {};

    let coverImagePath = coverImage || existingPost.image || '';
    if (typeof coverImagePath === 'string' && coverImagePath.startsWith('data:image/')) {
      coverImagePath = saveBase64Image(coverImagePath) || existingPost.image;
    }

    let galleryPaths = Array.isArray(galleryImages) ? processGalleryInput(galleryImages) : existingPost.galleryImages || [];
    galleryPaths = [...new Set((galleryPaths || []).filter(Boolean))];

    const updatedPost = {
      ...existingPost,
      title: title !== undefined ? String(title).trim() : existingPost.title,
      slug: slug !== undefined ? slug : existingPost.slug ?? null,
      type: normalizeCategory(category !== undefined ? category : existingPost.type || 'News'),
      image: coverImagePath || existingPost.image,
      htmlContent: htmlContent !== undefined ? String(htmlContent) : existingPost.htmlContent || existingPost.description || '',
      language: language !== undefined ? String(language) : existingPost.language || 'AZ',
      status: status !== undefined ? String(status) : existingPost.status || 'Active',
      publishStatus: publishStatus !== undefined ? String(publishStatus) : existingPost.publishStatus || 'Publish',
      author: author !== undefined ? String(author) : existingPost.author || 'admin',
    };

    if (updatedPost.htmlContent) {
      updatedPost.description = createDescription(updatedPost.htmlContent);
    }

    if (galleryPaths.length > 0) {
      updatedPost.galleryImages = galleryPaths;
    } else {
      delete updatedPost.galleryImages;
    }

    data.posts[index] = updatedPost;

    if (saveData(data)) {
      return res.status(200).json(updatedPost);
    }
    return res.status(500).json({ error: 'Failed to update post' });
  }

  // DELETE /api/posts/:id
  if (method === 'DELETE' && postId) {
    const index = data.posts.findIndex((p) => p.id === postId);
    if (index !== -1) {
      data.posts.splice(index, 1);
      data.total = data.posts.length;
      if (saveData(data)) {
        return res.status(200).json({ message: 'Post deleted' });
      }
      return res.status(500).json({ error: 'Failed to delete post' });
    }
    return res.status(404).json({ error: 'Post not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

