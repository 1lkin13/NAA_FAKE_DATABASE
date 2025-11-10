function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ textAlign: 'center', padding: '32px', maxWidth: '420px', width: '100%', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 35px rgba(15, 23, 42, 0.08)' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>NAA Database API</h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#475569' }}>Production Mock Database Server</p>
        </header>

        <section style={{ textAlign: 'left' }}>
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
      </div>
    </div>
  );
}

export default App;

