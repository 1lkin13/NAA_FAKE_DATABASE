export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
      <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)', maxWidth: '520px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '12px', color: '#0f172a' }}>NAA Database API</h1>
        <p style={{ marginBottom: '24px', color: '#334155' }}>
          This project exposes serverless endpoints for reading and writing posts backed by a JSON file.
        </p>
        <div style={{ display: 'grid', gap: '12px' }}>
          <section>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b' }}>Endpoints</h2>
            <ul style={{ paddingLeft: '18px', color: '#475569', fontSize: '14px' }}>
              <li><code>GET /api/posts</code> – fetch all posts</li>
              <li><code>POST /api/create-post</code> – create a post with multipart/form-data</li>
              <li><code>POST /api/ut-upload</code> – proxy to UploadThing (optional)</li>
            </ul>
          </section>
          <section>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b' }}>Storage</h2>
            <p style={{ color: '#475569', fontSize: '14px' }}>
              Posts are stored in <code>mock_data_production.json</code>. On Vercel, writes happen in the temporary
              filesystem and are re-seeded from the repository on each deployment.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}


