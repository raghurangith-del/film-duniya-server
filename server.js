const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.sendStatus(200));

// FIX: Claude code ki match ayye format
app.get('/movie/:id', (req, res) => {
  const tmdbId = req.params.id;
  // Claude code lo 'success' and 'm3u8' vethukuntundi kabatti
  res.json({ 
    success: true, 
    m3u8: `https://vidsrc.to/embed/movie/${tmdbId}` 
  });
});

// TV Series episodes fix
app.get('/tv/:id/:s/:e', (req, res) => {
  const { id, s, e } = req.params;
  res.json({ 
    success: true, 
    m3u8: `https://vidsrc.to/embed/tv/${id}/${s}/${e}` 
  });
});

app.listen(PORT, () => console.log(`Server live on ${PORT}`));