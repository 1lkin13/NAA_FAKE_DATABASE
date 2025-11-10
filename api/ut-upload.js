module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', (c) => chunks.push(c));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const body = Buffer.concat(chunks);

    const resp = await fetch('https://uploadthing.com/api/uploadFiles', {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || '',
        'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET || process.env.UPLOADTHING_TOKEN || '',
        'X-Uploadthing-App-Id': process.env.UPLOADTHING_APP_ID || '',
        'X-Uploadthing-Version': '6',
      },
      body,
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    res.status(resp.status).json(data);
  } catch (e) {
    console.error('ut-upload error', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


