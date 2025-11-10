export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    const response = await fetch('https://uploadthing.com/api/uploadFiles', {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || '',
        'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET,
        'X-Uploadthing-App-Id': process.env.UPLOADTHING_APP_ID,
        'X-Uploadthing-Version': '6',
      },
      body,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('ut-upload proxy error', error);
    res.status(500).json({ error: 'Upload proxy failed' });
  }
}


