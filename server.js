// Development server - Express API server for local development
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { UTApi } from 'uploadthing/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = join(__dirname, 'mock.data.production.json');
const FILES_DIR = join(__dirname, 'public', 'files');

// Ensure directories exist
mkdirSync(FILES_DIR, { recursive: true });

// CORS configuration - Allow all origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400,
  exposedHeaders: ['Content-Length', 'Content-Type'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Helper functions
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
      // ignore
    }
    return [trimmed];
  }
  return [];
};

const ensureFilesDir = () => {
  mkdirSync(FILES_DIR, { recursive: true });
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

const uploadthingToken = process.env.UPLOADTHING_TOKEN;
const uploadthingSecret = process.env.UPLOADTHING_SECRET; // backward compatibility
const utapi = uploadthingToken
  ? new UTApi({ token: uploadthingToken })
  : (uploadthingSecret ? new UTApi({ token: uploadthingSecret }) : null);
const isReadOnlyFs = !!process.env.VERCEL;

const uploadBuffer = async (buffer, filename, mimeType) => {
  if (utapi) {
    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
    const result = await utapi.uploadFiles([{ name: filename, blob }]);
    const first = Array.isArray(result) ? result[0] : undefined;
    const fileUrl =
      first?.data?.url ??
      first?.data?.fileUrl ??
      first?.url ??
      first?.fileUrl;
    if (!fileUrl) {
      const message =
        (Array.isArray(first?.error) ? first?.error[0]?.message : first?.error?.message) ||
        (typeof first?.error === 'string' ? first.error : null) ||
        'Failed to upload image';
      throw new Error(message);
    }
    return fileUrl;
  }

  if (isReadOnlyFs) {
    throw new Error('UploadThing API key is not configured');
  }

  ensureFilesDir();
  const filepath = join(FILES_DIR, filename);
  writeFileSync(filepath, buffer);
  return `/files/${filename}`;
};

const saveBase64Image = async (imageData) => {
  if (!imageData || typeof imageData !== 'string') {
    return imageData;
  }

  if (!imageData.startsWith('data:image/')) {
    return imageData;
  }

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
  return uploadBuffer(buffer, filename, mimeType);
};

const processGalleryInput = async (gallery) => {
  const normalized = normalizeGallery(gallery);
  if (normalized.length === 0) {
    return [];
  }
  const results = [];
  for (const item of normalized) {
    const processed = await saveBase64Image(item);
    if (processed) {
      results.push(processed);
    }
  }
  return results;
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

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'NAA Database API Server',
    endpoints: {
      posts: '/api/posts',
      images: '/files/',
    },
  });
});

// GET /api/posts
app.get('/api/posts', (req, res) => {
  const data = loadData();
  let posts = [...data.posts];

  // Filter by type
  if (req.query.type && req.query.type !== 'All Posts') {
    posts = posts.filter((post) => post.type === normalizeCategory(req.query.type));
  }

  // Filter by status
  if (req.query.status && req.query.status !== 'All Status') {
    posts = posts.filter((post) => post.status === req.query.status);
  }

  // Search
  if (req.query.search) {
    const searchLower = req.query.search.toLowerCase();
    posts = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(searchLower) ||
        (post.description || '').toLowerCase().includes(searchLower) ||
        (post.author || '').toLowerCase().includes(searchLower)
    );
  }

  // Sort by createdAt descending
  posts.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // Pagination
  const page = parseInt(req.query.page || '1');
  const itemsPerPage = parseInt(req.query.itemsPerPage || '10');
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPosts = posts.slice(startIndex, endIndex);

  res.json({
    posts: paginatedPosts,
    total: posts.length,
  });
});

// GET /api/posts/:id
app.get('/api/posts/:id', (req, res) => {
  const data = loadData();
  const post = data.posts.find((p) => p.id === req.params.id);
  if (post) {
    res.json(post);
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
});

// POST /api/posts
app.post('/api/posts', async (req, res) => {
  const data = loadData();
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
  } = req.body || {};

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!htmlContent) {
    return res.status(400).json({ error: 'htmlContent is required' });
  }

  let coverImagePath = coverImage || '';
  if (coverImagePath.startsWith('data:image/')) {
    coverImagePath = await saveBase64Image(coverImagePath);
  }

  if (!coverImagePath) {
    return res.status(400).json({ error: 'Cover image is required' });
  }

  let galleryPaths = Array.isArray(galleryImages) ? processGalleryInput(galleryImages) : [];
  galleryPaths = [...new Set(galleryPaths.filter(Boolean))];

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
});

// PUT /api/posts/:id
app.put('/api/posts/:id', async (req, res) => {
  const data = loadData();
  const index = data.posts.findIndex((p) => p.id === req.params.id);
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
  } = req.body || {};

  let coverImagePath = coverImage || existingPost.image || '';
  if (typeof coverImagePath === 'string' && coverImagePath.startsWith('data:image/')) {
    coverImagePath = await saveBase64Image(coverImagePath) || existingPost.image;
  }

  if (!coverImagePath) {
    coverImagePath = existingPost.image || '';
  }

  let galleryPaths = Array.isArray(galleryImages) ? processGalleryInput(galleryImages) : existingPost.galleryImages || [];
  galleryPaths = [...new Set((galleryPaths || []).filter(Boolean))];

  galleryPaths = [...new Set((galleryPaths || []).filter(Boolean))];

  const titleValue =
    titleRaw !== undefined && titleRaw !== null ? String(titleRaw).trim() || existingPost.title : existingPost.title;
  const slugValue =
    slugRaw !== undefined && slugRaw !== null ? (slugRaw ? String(slugRaw) : null) : existingPost.slug ?? null;
  const categoryValue =
    categoryRaw !== undefined && categoryRaw !== null ? String(categoryRaw) : existingPost.type || 'News';
  const htmlContentValue =
    htmlContentRaw !== undefined && htmlContentRaw !== null
      ? String(htmlContentRaw)
      : existingPost.htmlContent || existingPost.description || '';
  const languageValue =
    languageRaw !== undefined && languageRaw !== null ? String(languageRaw) : existingPost.language || 'AZ';
  const statusValue =
    statusRaw !== undefined && statusRaw !== null ? String(statusRaw) : existingPost.status || 'Active';
  const publishStatusValue =
    publishStatusRaw !== undefined && publishStatusRaw !== null
      ? String(publishStatusRaw)
      : existingPost.publishStatus || 'Publish';
  const authorValue =
    authorRaw !== undefined && authorRaw !== null ? String(authorRaw) : existingPost.author || 'admin';

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
    return res.json(updatedPost);
  }

  return res.status(500).json({ error: 'Failed to update post' });
});

// DELETE /api/posts/:id
app.delete('/api/posts/:id', (req, res) => {
  const data = loadData();
  const index = data.posts.findIndex((p) => p.id === req.params.id);
  if (index !== -1) {
    data.posts.splice(index, 1);
    data.total = data.posts.length;
    if (saveData(data)) {
      res.json({ message: 'Post deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete post' });
    }
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
});

app.listen(PORT, () => {
  console.log('\n🚀 NAA Database API Server is running!');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📁 Static files: http://localhost:${PORT}/files/`);
  console.log(`📊 API Posts: http://localhost:${PORT}/api/posts`);
  console.log(`📤 Upload: http://localhost:${PORT}/api/upload`);
  console.log(`\n✨ Ready to serve requests!\n`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use!`);
    console.error(`\n💡 FIX: netstat -ano | findstr :${PORT}\n`);
    process.exit(1);
  }
});

