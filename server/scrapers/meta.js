import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { insertAd, updateSearchStatus } from '../db/index.js';
import { checkAdRelevance } from '../ai/analyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COUNTRY_CODES = {
  'united states': 'US',
  'usa': 'US',
  'us': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'canada': 'CA',
  'australia': 'AU',
  'germany': 'DE',
  'france': 'FR',
  'spain': 'ES',
  'italy': 'IT',
  'brazil': 'BR',
  'mexico': 'MX',
  'india': 'IN',
};

function getCountryCode(location) {
  const normalized = location.toLowerCase().trim();
  return COUNTRY_CODES[normalized] || 'US';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 1000, max = 3000) {
  return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

export async function scrapeMetaAds(searchId, params, sendProgress) {
  const { keywords, location, adCount = 25, filterRelevant = false } = params;
  const countryCode = getCountryCode(location || 'US');
  const screenshotsDir = join(__dirname, '..', '..', 'screenshots');

  // Calculate scrolls needed - be generous to ensure we load enough ads
  // Meta loads ~3-4 ads per scroll, so we scroll extra to be safe
  const maxScrolls = Math.min(Math.ceil(adCount / 3) + 5, 40);
  const maxAdsToCapture = adCount;

  sendProgress(searchId, {
    type: 'status',
    message: 'Launching browser...',
    step: 1,
    totalSteps: 5
  });

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${countryCode}&q=${encodeURIComponent(keywords)}&search_type=keyword_unordered&media_type=all`;

    sendProgress(searchId, {
      type: 'status',
      message: 'Navigating to Meta Ad Library...',
      step: 2,
      totalSteps: 5
    });

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await randomDelay(3000, 5000);

    sendProgress(searchId, {
      type: 'status',
      message: 'Waiting for ads to load...',
      step: 3,
      totalSteps: 5
    });

    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    await randomDelay(2000, 3000);

    // Scroll to load more ads - keep scrolling until we have enough
    sendProgress(searchId, {
      type: 'status',
      message: `Scrolling to load ads (targeting ${maxAdsToCapture})...`,
      step: 4,
      totalSteps: 5
    });

    let scrollCount = 0;
    let loadedAdCount = 0;
    let noNewAdsCount = 0; // Track consecutive scrolls with no new ads

    while (scrollCount < maxScrolls && loadedAdCount < maxAdsToCapture * 1.5) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await randomDelay(1200, 2000);
      scrollCount++;

      // Check how many ads are currently loaded (quick count)
      const currentCount = await page.evaluate(() => {
        let count = 0;
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.innerText && el.innerText.includes('Started running on') &&
              el.innerText.length < 2000) {
            count++;
          }
        });
        return Math.floor(count / 3); // Rough estimate (multiple elements per ad)
      });

      // Check if we found new ads
      if (currentCount > loadedAdCount) {
        loadedAdCount = currentCount;
        noNewAdsCount = 0;
      } else {
        noNewAdsCount++;
      }

      sendProgress(searchId, {
        type: 'scroll',
        message: `Loading ads... found ~${loadedAdCount} (target: ${maxAdsToCapture})`,
        progress: Math.min((loadedAdCount / maxAdsToCapture) * 100, 95)
      });

      // Stop if we have enough ads or haven't found new ones in 5 scrolls
      if (loadedAdCount >= maxAdsToCapture * 1.2 || noNewAdsCount >= 5) {
        break;
      }
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1500);

    sendProgress(searchId, {
      type: 'status',
      message: 'Finding ad cards...',
      step: 5,
      totalSteps: 5
    });

    // Find ad cards by structural approach - look for divs containing "Started running" date text
    const adCards = await page.evaluate(() => {
      const cards = [];
      const adContainers = new Set();
      let debugInfo = { method: 'structural', dateTextsFound: 0, cardsFound: 0 };

      // Find all elements containing "Started running" which indicates an ad card
      const allElements = document.querySelectorAll('*');

      allElements.forEach(el => {
        // Look for elements that directly contain the date text (not deeply nested)
        if (el.childNodes.length > 0 && el.innerText &&
            el.innerText.includes('Started running on') &&
            el.innerText.length < 2000) {

          debugInfo.dateTextsFound++;

          // Walk up to find a reasonable container
          let container = el;
          for (let i = 0; i < 10; i++) {
            if (!container || !container.parentElement) break;

            const rect = container.getBoundingClientRect();
            const hasImage = container.querySelector('img') !== null;

            // Look for a container that's card-sized with an image
            if (hasImage && rect.width > 300 && rect.width < 1000 &&
                rect.height > 250 && rect.height < 1200) {

              if (!adContainers.has(container)) {
                adContainers.add(container);

                const text = container.innerText || '';
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                // Extract advertiser - look for Facebook page links
                let advertiser = 'Unknown';
                const pageLinks = container.querySelectorAll('a');
                for (const link of pageLinks) {
                  const linkText = link.innerText.trim();
                  if (linkText.length > 2 && linkText.length < 80 &&
                      !linkText.includes('Library ID') &&
                      !linkText.includes('Started running') &&
                      !linkText.includes('INSTAGRAM') &&
                      !linkText.includes('FACEBOOK') &&
                      !linkText.toLowerCase().includes('learn more') &&
                      !linkText.toLowerCase().includes('shop now') &&
                      !linkText.toLowerCase().includes('sign up') &&
                      !linkText.toLowerCase().includes('visit')) {
                    advertiser = linkText;
                    break;
                  }
                }

                // Extract ad copy - longer text lines that aren't metadata
                const copyLines = [];
                for (const line of lines) {
                  if (line.length > 30 &&
                      !line.includes('Started running') &&
                      !line.includes('Library ID') &&
                      !line.includes('About this ad') &&
                      !line.includes('INSTAGRAM.COM') &&
                      !line.includes('FACEBOOK.COM') &&
                      line !== advertiser) {
                    copyLines.push(line);
                    if (copyLines.join(' ').length > 500) break;
                  }
                }

                // Extract date
                const dateMatch = text.match(/Started running on ([A-Za-z]+ \d+,? \d{4})/);

                // Detect ad format (video, carousel, or image)
                let adFormat = 'image'; // default
                const hasVideo = container.querySelector('video') !== null ||
                                 text.toLowerCase().includes('watch video') ||
                                 container.querySelector('[aria-label*="video"]') !== null;
                const hasCarousel = container.querySelectorAll('img').length > 2 ||
                                   container.querySelector('[aria-label*="carousel"]') !== null ||
                                   container.querySelector('[aria-label*="scroll"]') !== null ||
                                   container.querySelector('button[aria-label*="Next"]') !== null;

                if (hasVideo) {
                  adFormat = 'video';
                } else if (hasCarousel) {
                  adFormat = 'carousel';
                }

                // Extract CTA and landing page URL
                let ctaText = '';
                let landingUrl = '';
                const ctaPatterns = ['learn more', 'shop now', 'sign up', 'get offer',
                                     'book now', 'contact us', 'download', 'subscribe',
                                     'get started', 'apply now', 'order now', 'buy now',
                                     'see more', 'watch more', 'listen now', 'get quote',
                                     'send message', 'call now', 'get directions', 'watch video'];

                for (const link of pageLinks) {
                  const linkText = link.innerText.trim();
                  const linkTextLower = linkText.toLowerCase();
                  const href = link.href || '';

                  // Check if this is a CTA button - must be SHORT text (actual CTA buttons are < 25 chars)
                  if (!ctaText && linkText.length <= 25) {
                    for (const pattern of ctaPatterns) {
                      // Check for exact match or very close match
                      if (linkTextLower === pattern ||
                          linkTextLower.startsWith(pattern) && linkText.length <= pattern.length + 5) {
                        ctaText = linkText;
                        break;
                      }
                    }
                  }

                  // Check for external landing page URL
                  if (href && !href.includes('facebook.com') && !href.includes('instagram.com') &&
                      href.startsWith('http') && !href.includes('l.facebook.com')) {
                    landingUrl = href;
                  }

                  // Also check for l.facebook.com redirect URLs (extract destination)
                  if (href && href.includes('l.facebook.com')) {
                    try {
                      const url = new URL(href);
                      const destUrl = url.searchParams.get('u');
                      if (destUrl) {
                        landingUrl = decodeURIComponent(destUrl);
                      }
                    } catch {}
                  }
                }

                // Also look for CTA in button elements
                if (!ctaText) {
                  const buttons = container.querySelectorAll('div[role="button"], span[role="button"]');
                  for (const btn of buttons) {
                    const btnText = btn.innerText.trim();
                    const btnTextLower = btnText.toLowerCase();
                    if (btnText.length <= 25) {
                      for (const pattern of ctaPatterns) {
                        if (btnTextLower === pattern || btnTextLower.includes(pattern)) {
                          ctaText = btnText;
                          break;
                        }
                      }
                    }
                    if (ctaText) break;
                  }
                }

                cards.push({
                  top: rect.top + window.scrollY,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                  advertiser: advertiser.substring(0, 100),
                  adCopy: copyLines.join(' ').substring(0, 800),
                  startDate: dateMatch ? dateMatch[1] : '',
                  ctaText: ctaText.substring(0, 50),
                  landingUrl: landingUrl.substring(0, 500),
                  adFormat: adFormat
                });

                debugInfo.cardsFound++;
              }
              break;
            }
            container = container.parentElement;
          }
        }
      });

      // Sort by position (top to bottom, left to right)
      cards.sort((a, b) => a.top - b.top || a.left - b.left);

      // Remove duplicates - must be close in BOTH vertical AND horizontal position
      // Meta shows ads in a grid, so same-row ads have similar top but different left
      const uniqueCards = [];
      for (const card of cards) {
        const isDuplicate = uniqueCards.some(c =>
          Math.abs(c.top - card.top) < 50 && Math.abs(c.left - card.left) < 50
        );
        if (!isDuplicate) {
          uniqueCards.push(card);
        }
      }

      debugInfo.afterDedup = uniqueCards.length;
      return { cards: uniqueCards, debug: debugInfo };
    });

    console.log(`Found ${adCards.cards.length} ad cards from detection (requested: ${maxAdsToCapture})`);
    console.log('Debug:', JSON.stringify(adCards.debug));

    const foundCards = adCards.cards.slice(0, maxAdsToCapture);

    if (foundCards.length === 0) {
      const debugPath = join(screenshotsDir, `debug-${searchId}.png`);
      await page.screenshot({ path: debugPath, fullPage: true });

      sendProgress(searchId, {
        type: 'warning',
        message: 'No ads found. Debug screenshot saved.'
      });

      updateSearchStatus(searchId, 'completed', 0);
      await browser.close();
      return;
    }

    // Warn if we found fewer ads than requested
    if (foundCards.length < maxAdsToCapture) {
      sendProgress(searchId, {
        type: 'warning',
        message: `Only found ${foundCards.length} ads (requested ${maxAdsToCapture}). Proceeding with available ads.`
      });
    }

    sendProgress(searchId, {
      type: 'status',
      message: `Found ${foundCards.length} ads. Capturing screenshots...`,
      totalAds: foundCards.length
    });

    let capturedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < foundCards.length; i++) {
      try {
        const card = foundCards[i];

        // Check relevance if filtering is enabled
        if (filterRelevant) {
          sendProgress(searchId, {
            type: 'checking',
            message: `Checking relevance: ${card.advertiser}`,
            progress: (i / foundCards.length) * 100
          });

          const relevanceCheck = await checkAdRelevance(card.adCopy, card.advertiser, keywords);

          if (!relevanceCheck.relevant) {
            skippedCount++;
            sendProgress(searchId, {
              type: 'skipped',
              message: `Skipped (not relevant): ${card.advertiser} - ${relevanceCheck.reason}`,
              progress: (i / foundCards.length) * 100
            });
            continue;
          }
        }

        sendProgress(searchId, {
          type: 'capturing',
          message: `Capturing ad ${i + 1}/${foundCards.length}: ${card.advertiser}`,
          progress: (i / foundCards.length) * 100
        });

        // Scroll to position the card in view
        await page.evaluate((scrollTo) => {
          window.scrollTo({ top: scrollTo, behavior: 'instant' });
        }, card.top - 100);

        await sleep(600);

        const screenshotId = uuidv4();
        const screenshotPath = `${screenshotId}.png`;
        const fullPath = join(screenshotsDir, screenshotPath);

        // Find the actual ad preview element (the white card with the ad content)
        // Look for the inner ad card that contains "Sponsored" text
        const adBounds = await page.evaluate((cardTop) => {
          // Find all potential ad card elements currently visible
          const viewportTop = window.scrollY;
          const viewportBottom = viewportTop + window.innerHeight;

          // Look for elements that look like ad cards (white background, contains key ad elements)
          const candidates = document.querySelectorAll('div');

          for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            const absTop = rect.top + window.scrollY;

            // Check if this element is near where we expect the card
            if (Math.abs(absTop - cardTop) > 200) continue;

            // Look for ad card characteristics
            const text = el.innerText || '';
            const hasSponsored = text.includes('Sponsored');
            const hasAdContent = text.includes('Started running') || text.includes('Library ID');

            // Check for reasonable ad card dimensions (not too wide, not too narrow)
            if (hasSponsored && hasAdContent &&
                rect.width >= 300 && rect.width <= 700 &&
                rect.height >= 200 && rect.height <= 800) {

              // Found a good candidate - return viewport-relative bounds
              return {
                x: Math.max(0, rect.left),
                y: Math.max(0, rect.top),
                width: rect.width,
                height: rect.height,
                found: true
              };
            }
          }

          return { found: false };
        }, card.top);

        let clipConfig;

        if (adBounds.found) {
          // Use the detected ad card bounds
          clipConfig = {
            x: Math.max(0, adBounds.x),
            y: Math.max(0, adBounds.y),
            width: Math.min(adBounds.width, 700),
            height: Math.min(adBounds.height, 800)
          };
        } else {
          // Fallback to original approach but with tighter bounds
          // Center the clip on the expected ad location
          const centerX = card.left + card.width / 2;
          clipConfig = {
            x: Math.max(0, centerX - 300),
            y: 100,
            width: 600,
            height: Math.min(card.height, 700)
          };
        }

        await page.screenshot({
          path: fullPath,
          clip: clipConfig
        });

        // Clean advertiser
        const cleanAdvertiser = (card.advertiser || 'Unknown')
          .replace(/[\u200b-\u200d\ufeff]/g, '')
          .trim() || 'Unknown';

        // Save to database
        const adId = insertAd(searchId, {
          platform: 'meta',
          advertiserName: cleanAdvertiser,
          adCopy: card.adCopy || '',
          screenshotPath,
          startDate: card.startDate || '',
          mediaType: card.adFormat || 'image',
          ctaText: card.ctaText || '',
          landingUrl: card.landingUrl || ''
        });

        capturedCount++;

        sendProgress(searchId, {
          type: 'ad_captured',
          message: `Captured: ${cleanAdvertiser}`,
          ad: {
            id: adId,
            advertiserName: cleanAdvertiser,
            adCopy: card.adCopy || '',
            screenshotPath,
            startDate: card.startDate || '',
            ctaText: card.ctaText || '',
            landingUrl: card.landingUrl || '',
            mediaType: card.adFormat || 'image'
          },
          progress: ((i + 1) / foundCards.length) * 100,
          capturedCount,
          totalAds: foundCards.length
        });

        await randomDelay(500, 1000);

      } catch (err) {
        console.error(`Error capturing ad ${i + 1}:`, err.message);
        sendProgress(searchId, {
          type: 'warning',
          message: `Skipped ad ${i + 1}: ${err.message}`
        });
      }
    }

    updateSearchStatus(searchId, 'completed', capturedCount);

    const skipMsg = skippedCount > 0 ? ` (${skippedCount} filtered as irrelevant)` : '';
    sendProgress(searchId, {
      type: 'complete',
      message: `Completed! Captured ${capturedCount} ads.${skipMsg}`,
      totalAds: capturedCount,
      skippedCount
    });

  } catch (error) {
    console.error('Scraping error:', error);
    updateSearchStatus(searchId, 'error');

    sendProgress(searchId, {
      type: 'error',
      message: error.message
    });

    try {
      const debugPath = join(screenshotsDir, `error-${searchId}.png`);
      await page.screenshot({ path: debugPath, fullPage: true });
    } catch {}

  } finally {
    await browser.close();
  }
}
