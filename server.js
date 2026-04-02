const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Film Duniya Scraper is Running! 🚀');
});

// Example API endpoint for video links
app.get('/play', (req, res) => {
  const tmdbId = req.query.id;
  // Ikada JavaScript extraction logic rayali ads skip cheyadaniki
  res.json({ url: `https://vidsrc.to/embed/movie/${tmdbId}` }); 
});

app.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});