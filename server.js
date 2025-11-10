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
  credentials: true,
  maxAge: 86400,
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
    posts = posts.filter((post) => post.type === req.query.type);
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
        post.description.toLowerCase().includes(searchLower) ||
        post.author.toLowerCase().includes(searchLower)
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
  const newPost = {
    ...req.body,
    id: `post-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  data.posts.push(newPost);
  data.total = data.posts.length;

  if (saveData(data)) {
    res.status(201).json(newPost);
  } else {
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// PUT /api/posts/:id
app.put('/api/posts/:id', (req, res) => {
  const data = loadData();
  const index = data.posts.findIndex((p) => p.id === req.params.id);
  if (index !== -1) {
    data.posts[index] = { ...data.posts[index], ...req.body };
    if (saveData(data)) {
      res.json(data.posts[index]);
    } else {
      res.status(500).json({ error: 'Failed to update post' });
    }
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
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

