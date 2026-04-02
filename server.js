const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.sendStatus(200));

// Movie route
app.get('/movie/:id', (req, res) => {
  const tmdbId = req.params.id;
  // Direct vidsrc embed link pampisthunnam, deenni WebView lo load chestham
  res.json({ 
    success: true, 
    m3u8: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` 
  });
});

// TV Series route
app.get('/tv/:id/:s/:e', (req, res) => {
  const { id, s, e } = req.params;
  res.json({ 
    success: true, 
    m3u8: `https://vidsrc.me/embed/tv?tmdb=${id}&sea=${s}&epi=${e}` 
  });
});

app.listen(PORT, () => console.log(`Server live on ${PORT}`));