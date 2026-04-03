const express   = require('express');
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');
const cors      = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── Ad domains to block ──
const AD_DOMAINS = [
  'doubleclick','googlesyndication','adservice',
  'amazon-adsystem','outbrain','taboola','popads',
  'popcash','exoclick','juicyads','trafficjunky',
  'adsterra','propellerads','pushground','mgid',
  'revcontent','sharethrough','betting','1xbet',
  'chaturbate','sexytalk','cherrylive',
];

// ── Launch browser ──
async function launchBrowser() {
  return puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
}

// ── Extract stream from one URL ──
async function extractFromUrl(embedUrl, referer) {
  let browser = null;
  try {
    console.log(`\n🔍 Trying: ${embedUrl}`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    let m3u8Master = null;
    let m3u8Stream = null;

    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'Referer':         referer,
      'Origin':          referer,
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
      const url  = req.url().toLowerCase();
      const type = req.resourceType();

      // Block ads
      if (AD_DOMAINS.some(d => url.includes(d))) {
        req.abort();
        return;
      }
      // Block heavy unused resources
      if (['image','font','stylesheet'].includes(type)) {
        req.abort();
        return;
      }
      req.continue();
    });

    // Capture m3u8
    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('.m3u8')) return;

      try {
        if (url.includes('master') || url.includes('index') || url.includes('playlist')) {
          if (!m3u8Master) {
            m3u8Master = url;
            console.log('🎯 Master m3u8:', url);
          }
        } else if (!m3u8Stream) {
          m3u8Stream = url;
          console.log('📺 Stream m3u8:', url);
        }
      } catch (_) {}
    });

    // Navigate
    await page.goto(embedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    }).catch(() => {
      console.log('⚠️ networkidle2 timeout — checking results...');
    });

    // Wait up to 15s for m3u8
    for (let i = 0; i < 15; i++) {
      if (m3u8Master || m3u8Stream) break;
      await page.waitForTimeout(1000);

      // Try clicking play button
      if (i === 3) {
        try {
          await page.click('video');
        } catch (_) {}
        try {
          await page.evaluate(() => {
            const btns = document.querySelectorAll(
              '.jw-icon-display, .play-btn, [class*="play"], button'
            );
            for (const btn of btns) {
              try { btn.click(); } catch (_) {}
            }
          });
        } catch (_) {}
      }
    }

    // Try regex extraction from page source if not found
    if (!m3u8Master && !m3u8Stream) {
      try {
        const content = await page.content();
        const patterns = [
          /["'](https?:\/\/[^"']+\.m3u8[^"']*)/g,
          /file\s*:\s*["'](https?:\/\/[^"']+)/g,
          /src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/g,
          /source\s*=\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/g,
        ];
        for (const pattern of patterns) {
          const matches = [...content.matchAll(pattern)];
          if (matches.length > 0) {
            let url = matches[0][1];
            if (!url.startsWith('http')) url = 'https:' + url;
            m3u8Stream = url;
            console.log('📄 Found in source:', url);
            break;
          }
        }
      } catch (_) {}
    }

    const result = m3u8Master || m3u8Stream;
    return result || null;

  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ── Try multiple sources ──
async function tryExtract(sources) {
  for (const { url, ref } of sources) {
    const m3u8 = await extractFromUrl(url, ref);
    if (m3u8) return { m3u8, source: url };
  }
  return null;
}

// ════════════════════════════════════
// ROUTES
// ════════════════════════════════════

// Movie
app.get('/movie/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`\n🎬 Movie request: ${id}`);

  const sources = [
    { url: `https://vidsrc.xyz/embed/movie?tmdb=${id}`,   ref: 'https://vidsrc.xyz' },
    { url: `https://vidsrc.to/embed/movie/${id}`,          ref: 'https://vidsrc.to' },
    { url: `https://embed.su/embed/movie/${id}`,           ref: 'https://embed.su' },
    { url: `https://vidsrc.cc/v2/embed/movie/${id}`,       ref: 'https://vidsrc.cc' },
  ];

  const result = await tryExtract(sources);

  if (result) {
    console.log(`✅ Success: ${result.m3u8}`);
    res.json({ success: true, m3u8: result.m3u8, movieId: id });
  } else {
    console.log('❌ All sources failed');
    res.json({ success: false, m3u8: null, movieId: id });
  }
});

// TV
app.get('/tv/:id/:season/:episode', async (req, res) => {
  const { id, season, episode } = req.params;
  console.log(`\n📺 TV request: ${id} S${season}E${episode}`);

  const sources = [
    { url: `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`, ref: 'https://vidsrc.xyz' },
    { url: `https://vidsrc.to/embed/tv/${id}/${season}-${episode}`,                      ref: 'https://vidsrc.to' },
    { url: `https://embed.su/embed/tv/${id}/${season}/${episode}`,                       ref: 'https://embed.su' },
    { url: `https://vidsrc.cc/v2/embed/tv/${id}?season=${season}&episode=${episode}`,    ref: 'https://vidsrc.cc' },
  ];

  const result = await tryExtract(sources);

  if (result) {
    res.json({ success: true, m3u8: result.m3u8, tvId: id, season, episode });
  } else {
    res.json({ success: false, m3u8: null });
  }
});

// Health
app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/', (_, res) => {
  res.json({ message: 'Film Duniya Scraper Server v3 ✅' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Film Duniya Server running on port ${PORT}`);
});