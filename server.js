// Development server - Express API server for local development
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import multer from 'multer';

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

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FILES_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.originalname.split('.').pop();
    cb(null, `upload-${timestamp}-${randomStr}.${extension}`);
  },
});
const upload = multer({ storage });

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

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'NAA Database API Server',
    endpoints: {
      posts: '/api/posts',
      upload: '/api/upload',
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
app.post('/api/posts', (req, res) => {
  const data = loadData();
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
  } = req.body || {};

  if (!title || !htmlContent || !coverImage) {
    return res.status(400).json({ error: 'Missing required fields (title, htmlContent, coverImage)' });
  }

  const now = new Date();
  let coverImagePath;
  try {
    coverImagePath = saveBase64Image(coverImage);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid cover image' });
  }

  let galleryPaths = [];
  try {
    galleryPaths = processGalleryInput(galleryImages);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid gallery image' });
  }
  const normalizedGallery = normalizeGallery(galleryImages);

  const newPost = {
    id: `prod-${Date.now()}`,
    title: title.trim(),
    slug: slug || null,
    image: coverImagePath,
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
});

// PUT /api/posts/:id
app.put('/api/posts/:id', (req, res) => {
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
    coverImage,
    galleryImages,
    language,
    status,
    publishStatus,
    author,
  } = req.body || {};

  let coverImagePath = existingPost.image;
  try {
    coverImagePath = saveBase64Image(coverImage) || existingPost.image;
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid cover image' });
  }

  const updatedPost = {
    ...existingPost,
    title: title !== undefined ? title.trim() : existingPost.title,
    slug: slug !== undefined ? slug : existingPost.slug,
    type: category ? normalizeCategory(category) : existingPost.type,
    image: coverImagePath,
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

// POST /api/upload - Image upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/files/${req.file.filename}`;
  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
  });
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
    console.error(`\n💡 Çözüm: netstat -ano | findstr :${PORT}\n`);
    process.exit(1);
  }
});

