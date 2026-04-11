const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const app     = express();

app.use(cors());

const PORT = process.env.PORT || 3000;

const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmOTFlOTY1MjI5NWI4MGQ3ZDQwZjY3Y2E0MDZlZmE0OCIsIm5iZiI6MTc3NDY4MjE0Mi45OTIsInN1YiI6IjY5Yzc4MDFlYTdhODlkMmQ3ZjlkNDk5NCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.2mQvFdnOeF63Mo85S69zn2UgI3X12jOz74xuen0Pu7E';

// ✅ TMDB Proxy — Jio bypass
app.get('/tmdb/*', async (req, res) => {
  try {
    const path  = req.params[0];
    const query = new URLSearchParams(req.query).toString();
    const url   = `https://api.themoviedb.org/3/${path}${query ? '?' + query : ''}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${TMDB_TOKEN}`,
        'accept': 'application/json',
      },
      timeout: 15000,
    });

    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Image Proxy — Jio bypass
app.get('/img/*', async (req, res) => {
  try {
    const path     = req.params[0];
    const url      = `https://image.tmdb.org/t/p/${path}`;
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (e) {
    res.status(404).send('Not found');
  }
});

// Health
app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/', (_, res) => {
  res.json({ message: 'Film Duniya Server ✅' });
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));