const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── Movie Stream ──
app.get('/movie/:id', (req, res) => {
  const id = req.params.id;
  console.log(`Movie: ${id}`);
  res.json({
    success: true,
    sources: [
      `https://vidsrc.cc/v2/embed/movie/${id}?auto_select=true`,
      `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
      `https://embed.su/embed/movie/${id}`,
      `https://vidsrc.to/embed/movie/${id}`,
      `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    ],
  });
});

// ── TV Stream ──
app.get('/tv/:id/:season/:episode', (req, res) => {
  const { id, season, episode } = req.params;
  console.log(`TV: ${id} S${season}E${episode}`);
  res.json({
    success: true,
    sources: [
      `https://vidsrc.cc/v2/embed/tv/${id}?season=${season}&episode=${episode}&auto_select=true`,
      `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
      `https://embed.su/embed/tv/${id}/${season}/${episode}`,
      `https://vidsrc.to/embed/tv/${id}/${season}-${episode}`,
      `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
    ],
  });
});

// ── Health ──
app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/', (_, res) => {
  res.json({ message: 'Film Duniya Server ✅' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});