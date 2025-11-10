// Vercel Serverless Function - GET, POST, PUT, DELETE posts
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'mock.data.production.json');

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

export default async function handler(req, res) {
  // CORS headers - Allow all origins and methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  const data = loadData();
  const { method, query, body } = req;
  
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

    // Filter by type
    if (query.type && query.type !== 'All Posts') {
      posts = posts.filter((post) => post.type === query.type);
    }

    // Filter by status
    if (query.status && query.status !== 'All Status') {
      posts = posts.filter((post) => post.status === query.status);
    }

    // Search
    if (query.search) {
      const searchLower = query.search.toLowerCase();
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
    const page = parseInt(query.page || '1');
    const itemsPerPage = parseInt(query.itemsPerPage || '10');
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
    // Try to extract from URL again for PUT/DELETE
    if (req.url) {
      const urlMatch = req.url.match(/\/api\/posts\/([^/?]+)/);
      if (urlMatch) {
        postId = urlMatch[1];
      }
    }
  }

  // POST /api/posts
  if (method === 'POST') {
    const newPost = {
      ...body,
      id: `post-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    data.posts.push(newPost);
    data.total = data.posts.length;
    
    if (saveData(data)) {
      return res.status(201).json(newPost);
    }
    return res.status(500).json({ error: 'Failed to save post' });
  }

  // PUT /api/posts/:id
  if (method === 'PUT' && postId) {
    const index = data.posts.findIndex((p) => p.id === postId);
    if (index !== -1) {
      data.posts[index] = { ...data.posts[index], ...body };
      if (saveData(data)) {
        return res.status(200).json(data.posts[index]);
      }
      return res.status(500).json({ error: 'Failed to update post' });
    }
    return res.status(404).json({ error: 'Post not found' });
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

