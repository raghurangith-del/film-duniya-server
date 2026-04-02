const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.sendStatus(200));

// Movie extraction logic
app.get('/movie/:id', async (req, res) => {
    const tmdbId = req.params.id;
    try {
        // Direct Embed URL badulu, manam direct file link ni target chestunnam
        // Note: BetterPlayer/ExoPlayer can play HLS (.m3u8) streams
        const streamUrl = `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
        
        res.json({ 
            success: true, 
            m3u8: streamUrl // Native player ki idi pass chestunnam
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// TV Series extraction logic
app.get('/tv/:id/:s/:e', async (req, res) => {
    const { id, s, e } = req.params;
    try {
        const streamUrl = `https://vidsrc.me/embed/tv?tmdb=${id}&sea=${s}&epi=${e}`;
        res.json({ 
            success: true, 
            m3u8: streamUrl 
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server live on ${PORT}`));