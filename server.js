const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── Launch Browser ──
async function getBrowser() {
  return puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: true,
    ignoreHTTPSErrors: true,
  });
}

// ── Block Ads in Browser ──
const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'adservice.google',
  'amazon-adsystem', 'ads.yahoo', 'outbrain', 'taboola',
  'popads.net', 'popcash.net', 'exoclick.com', 'juicyads.com',
  'trafficjunky', 'ero-advertising', 'plugrush', 'hilltopads',
  'adsterra', 'propellerads', 'pushground', 'richpush',
  'mgid.com', 'revcontent', 'sharethrough',
];

function isAdUrl(url) {
  return AD_DOMAINS.some(d => url.includes(d));
}

// ── Extract m3u8 from embed URL ──
async function extractStream(embedUrl, referer) {
  let browser;
  try {
    console.log(`\n🔍 Extracting from: ${embedUrl}`);
    browser = await getBrowser();
    const page = await browser.newPage();

    let m3u8Url   = null;
    let masterUrl = null;

    // Set headers
    await page.setExtraHTTPHeaders({
      'Referer':         referer || embedUrl,
      'Origin':          new URL(embedUrl).origin,
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36'
    );

    // Block ads, intercept m3u8
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      const url = req.url();
      const type = req.resourceType();

      // Block ads
      if (isAdUrl(url)) {
        req.abort();
        return;
      }

      // Block heavy resources
      if (['image', 'font', 'stylesheet'].includes(type)) {
        req.abort();
        return;
      }

      req.continue();
    });

    // Capture m3u8 responses
    page.on('response', async (res) => {
      const url = res.url();

      // Look for m3u8 in URL
      if (url.includes('.m3u8')) {
        // Prefer master playlist
        if (url.includes('master') || url.includes('index')) {
          masterUrl = url;
          console.log('📺 Master m3u8:', url);
        } else if (!m3u8Url) {
          m3u8Url = url;
          console.log('📺 m3u8:', url);
        }
      }

      // Try to find m3u8 in JSON responses
      if (!m3u8Url && res.headers()['content-type']?.includes('json')) {
        try {
          const text = await res.text();
          const match = text.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
          if (match) {
            m3u8Url = match[0];
            console.log('📺 m3u8 from JSON:', m3u8Url);
          }
        } catch (_) {}
      }
    });

    // Load the page
    await page.goto(embedUrl, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    }).catch(() => {
      console.log('⚠️ Page load timeout, checking for stream...');
    });

    // Wait for m3u8 (up to 15 more seconds)
    for (let i = 0; i < 15; i++) {
      if (masterUrl || m3u8Url) break;
      await new Promise(r => setTimeout(r, 1000));
      console.log(`⏳ Waiting... ${i + 1}s`);
    }

    // Try clicking play button if video not found
    if (!masterUrl && !m3u8Url) {
      try {
        await page.click('video');
        await new Promise(r => setTimeout(r, 3000));
      } catch (_) {}

      try {
        await page.click('.play-button, .jw-icon-display, button[class*="play"]');
        await new Promise(r => setTimeout(r, 3000));
      } catch (_) {}
    }

    // Try extracting from page source
    if (!masterUrl && !m3u8Url) {
      try {
        const content = await page.content();
        const patterns = [
          /["']?(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g,
          /file["']?\s*:\s*["']?(https?:\/\/[^"'\s]+)/g,
          /source["']?\s*:\s*["']?(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g,
        ];
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[0]) {
            m3u8Url = match[0].replace(/["']/g, '').split(':').slice(-2).join(':');
            if (!m3u8Url.startsWith('http')) m3u8Url = 'https:' + m3u8Url;
            console.log('📺 m3u8 from source:', m3u8Url);
            break;
          }
        }
      } catch (_) {}
    }

    const finalUrl = masterUrl || m3u8Url;
    console.log(finalUrl ? `✅ Found: ${finalUrl}` : '❌ Not found');
    return finalUrl;

  } catch (err) {
    console.error('❌ Extract error:', err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// ── Try multiple sources ──
async function tryAllSources(sources) {
  for (const { url, referer } of sources) {
    try {
      const m3u8 = await extractStream(url, referer);
      if (m3u8) return m3u8;
    } catch (e) {
      console.log(`⚠️ Source failed: ${url}`);
    }
  }
  return null;
}

// ════════════════════════════════════
// ROUTES
// ════════════════════════════════════

// Movie stream
app.get('/movie/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`\n🎬 Movie: ${id}`);

  const sources = [
    {
      url: `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
      referer: 'https://vidsrc.xyz',
    },
    {
      url: `https://vidsrc.to/embed/movie/${id}`,
      referer: 'https://vidsrc.to',
    },
    {
      url: `https://embed.su/embed/movie/${id}`,
      referer: 'https://embed.su',
    },
    {
      url: `https://player.videasy.net/movie/${id}`,
      referer: 'https://player.videasy.net',
    },
  ];

  const m3u8 = await tryAllSources(sources);

  res.json({
    success: !!m3u8,
    m3u8: m3u8 || null,
    movieId: id,
    message: m3u8 ? 'Stream extracted' : 'Could not extract stream',
  });
});

// TV stream
app.get('/tv/:id/:season/:episode', async (req, res) => {
  const { id, season, episode } = req.params;
  console.log(`\n📺 TV: ${id} S${season}E${episode}`);

  const sources = [
    {
      url: `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
      referer: 'https://vidsrc.xyz',
    },
    {
      url: `https://vidsrc.to/embed/tv/${id}/${season}-${episode}`,
      referer: 'https://vidsrc.to',
    },
    {
      url: `https://embed.su/embed/tv/${id}/${season}/${episode}`,
      referer: 'https://embed.su',
    },
    {
      url: `https://player.videasy.net/tv/${id}/${season}/${episode}`,
      referer: 'https://player.videasy.net',
    },
  ];

  const m3u8 = await tryAllSources(sources);

  res.json({
    success: !!m3u8,
    m3u8: m3u8 || null,
    tvId: id,
    season: parseInt(season),
    episode: parseInt(episode),
    message: m3u8 ? 'Stream extracted' : 'Could not extract stream',
  });
});

// Health check
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    service: 'Film Duniya Scraper',
  });
});

// Root
app.get('/', (_, res) => {
  res.json({ message: 'Film Duniya Server Running ✅' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Film Duniya Server on port ${PORT}`);
});