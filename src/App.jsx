function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ textAlign: 'center', padding: '32px', maxWidth: '420px', width: '100%', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 35px rgba(15, 23, 42, 0.08)' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>NAA Database API</h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#475569' }}>Production Mock Database Server</p>
        </header>

        <section style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Base URL</h2>
          <code style={{ display: 'block', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>https://naa-db.vercel.app</code>
        </section>

        <section style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>API Endpoints</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}>GET /api/posts</code>
              <span style={{ fontSize: '14px', color: '#475569' }}>Get all posts</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}>GET /api/posts/:id</code>
              <span style={{ fontSize: '14px', color: '#475569' }}>Get post by ID</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}>POST /api/posts</code>
              <span style={{ fontSize: '14px', color: '#475569' }}>Create new post</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}>PUT /api/posts/:id</code>
              <span style={{ fontSize: '14px', color: '#475569' }}>Update post</span> 
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}>DELETE /api/posts/:id</code>
              <span style={{ fontSize: '14px', color: '#475569' }}>Delete post</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}>POST /api/upload</code>
              <span style={{ fontSize: '14px', color: '#475569' }}>Upload image</span>
            </li>
          </ul>
        </section>

        <section style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Request Headers</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
            <li style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>JSON requests</span>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '12px' }}>Content-Type: application/json</code>
            </li>
            <li style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>File upload</span>
              <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '12px' }}>Content-Type: multipart/form-data</code>
            </li>
          </ul>
        </section>

        <section style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>POST / PUT Body</h2>
          <code style={{ display: 'block', background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '12px', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
{`{
  "title": "Post title",
  "slug": "post-title",
  "category": "News",
  "htmlContent": "<p>Rich text editor content</p>",
  "language": "AZ",
  "coverImage": "/files/upload-123.jpg" or "data:image/png;base64,...",
  "galleryImages": [
    "/files/upload-456.jpg",
    "data:image/png;base64,..."
  ],
  "status": "Active",
  "publishStatus": "Publish",
  "author": "admin"
}`}
          </code>
          <p style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>Use POST for create, PUT /api/posts/:id for update.</p>
        </section>

        <section style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>POST /api/upload</h2>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#475569' }}>Upload cover & gallery images before creating/updating posts.</p>
          <code style={{ display: 'block', background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '12px', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
{`Form-Data:
  file: <binary>

Response:
{
  "success": true,
  "url": "/files/upload-123.jpg",
  "filename": "upload-123.jpg"
}`}
          </code>
        </section>

        <section style={{ textAlign: 'left' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Sample Response</h2>
          <code style={{ display: 'block', background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '12px', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
{`{
  "id": "prod-1",
  "title": "Milli Aviasiya Akademiyasının 25 illik yubileyi qeyd edildi",
  "slug": "milli-aviasiya-akademiyasinin-25-illik-yubileyi-qeyd-edildi",
  "image": "/files/post-1.jpg",
  "htmlContent": "<p>...</p>",
  "description": "Milli Aviasiya Akademiyasının 25 illik...",
  "type": "News",
  "language": "AZ",
  "status": "Active",
  "publishStatus": "Publish",
  "author": "admin",
  "createdAt": "2025-01-15T10:00:00Z",
  "galleryImages": [
    "/files/post-1-gallery-1.jpg",
    "/files/post-1-gallery-2.jpg"
  ]
}`}
          </code>
        </section>
      </div>
    </div>
  );
}

export default App;

