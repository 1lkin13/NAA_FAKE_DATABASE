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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

const saveBase64Image = (imageData) => {
  if (!imageData || typeof imageData !== 'string') {
    return imageData;
  }

  if (!imageData.startsWith('data:image/')) {
    return imageData;
  }

  ensureFilesDir();

  const [metadata, dataPart] = imageData.split(';base64,');
  if (!dataPart) {
    throw new Error('Invalid image data format');
  }

  const mimeType = metadata.replace(/^data:/, '') || 'image/png';
  const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';
  const sanitized = dataPart.replace(/\s/g, '');

  let buffer;
  try {
    buffer = Buffer.from(sanitized, 'base64');
  } catch (error) {
    throw new Error('Image data is not valid base64');
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('Image data is empty');
  }

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error('Image size exceeds 5MB limit');
  }

  const filename = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
  const filepath = join(FILES_DIR, filename);
  writeFileSync(filepath, buffer);

  return `/files/${filename}`;
};

const processGalleryInput = (gallery) => {
  const normalized = normalizeGallery(gallery);
  if (normalized.length === 0) {
    return [];
  }
  return normalized.map((item) => saveBase64Image(item));
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
  const payload = parseRequestBody(rawBody);

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
    const { title, slug, category, htmlContent, coverImage, galleryImages, language, status, publishStatus, author } = payload;

    if (!title || !htmlContent || !coverImage) {
      return res.status(400).json({ error: 'Missing required fields (title, htmlContent, coverImage)' });
    }

    let savedCoverImage;
    try {
      savedCoverImage = saveBase64Image(coverImage);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid cover image' });
    }

    let galleryPaths = [];
    try {
      galleryPaths = processGalleryInput(galleryImages);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid gallery image' });
    }

    const now = new Date();
    const normalizedGallery = normalizeGallery(galleryImages);
    
    const newPost = {
      id: `prod-${Date.now()}`,
      title: title.trim(),
      slug: slug || null,
      image: savedCoverImage, // coverImage path'i image olarak saklanıyor
      description: createDescription(htmlContent),
      htmlContent: htmlContent,
      type: normalizeCategory(category),
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
      coverImage,
      galleryImages,
      language,
      status,
      publishStatus,
      author,
    } = payload;

    let savedCoverImage;
    try {
      savedCoverImage = saveBase64Image(coverImage);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid cover image' });
    }

    const updatedPost = {
      ...existingPost,
      title: title !== undefined ? title.trim() : existingPost.title,
      slug: slug !== undefined ? slug : existingPost.slug,
      type: category ? normalizeCategory(category) : existingPost.type,
      image: savedCoverImage || existingPost.image, // coverImage path'i image olarak saklanıyor
      htmlContent: htmlContent !== undefined ? htmlContent : existingPost.htmlContent || existingPost.description || '',
      language: language || existingPost.language || 'AZ',
      status: status || existingPost.status || 'Active',
      publishStatus: publishStatus || existingPost.publishStatus || 'Publish',
      author: author || existingPost.author || 'admin',
    };

    if (htmlContent !== undefined) {
      updatedPost.description = createDescription(htmlContent);
    }

    if (galleryImages !== undefined) {
      try {
        const galleryPaths = processGalleryInput(galleryImages);
        if (galleryPaths.length > 0) {
          updatedPost.galleryImages = galleryPaths;
        } else {
          delete updatedPost.galleryImages;
        }
      } catch (error) {
        return res.status(400).json({ error: error.message || 'Invalid gallery image' });
      }
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

