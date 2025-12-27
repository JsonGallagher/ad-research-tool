import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function scrapeLandingPage(url) {
  if (!url || !url.startsWith('http')) {
    return { error: 'Invalid URL' };
  }

  const screenshotsDir = join(__dirname, '..', '..', 'screenshots');

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // Navigate to the landing page
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract page metadata
    const pageData = await page.evaluate(() => {
      // Get title
      const title = document.title || '';

      // Get meta description
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

      // Get H1
      const h1 = document.querySelector('h1')?.innerText?.trim() || '';

      // Get primary CTA (look for main buttons)
      let primaryCta = '';
      const ctaSelectors = [
        'button[type="submit"]',
        'a.btn',
        'a.button',
        'button.btn',
        'button.button',
        '[class*="cta"]',
        '[class*="btn-primary"]',
        'a[href*="signup"]',
        'a[href*="register"]',
        'a[href*="demo"]',
        'a[href*="trial"]',
        'a[href*="get-started"]'
      ];

      for (const selector of ctaSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText && el.innerText.length < 50) {
          primaryCta = el.innerText.trim();
          break;
        }
      }

      // If no CTA found, look for any prominent button
      if (!primaryCta) {
        const buttons = document.querySelectorAll('button, a[role="button"]');
        for (const btn of buttons) {
          const text = btn.innerText?.trim();
          if (text && text.length > 2 && text.length < 40) {
            primaryCta = text;
            break;
          }
        }
      }

      // Get key messaging - first few paragraphs
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText?.trim())
        .filter(t => t && t.length > 30 && t.length < 500)
        .slice(0, 3);

      // Get final URL after any redirects
      const finalUrl = window.location.href;

      return {
        title,
        description: metaDesc,
        headline: h1,
        primaryCta,
        keyMessaging: paragraphs,
        finalUrl
      };
    });

    // Take screenshot of above-the-fold content
    const screenshotId = uuidv4();
    const screenshotPath = `lp-${screenshotId}.png`;
    const fullPath = join(screenshotsDir, screenshotPath);

    await page.screenshot({
      path: fullPath,
      clip: {
        x: 0,
        y: 0,
        width: 1280,
        height: 800
      }
    });

    await browser.close();

    return {
      url: pageData.finalUrl || url,
      title: pageData.title,
      description: pageData.description,
      headline: pageData.headline,
      primaryCta: pageData.primaryCta,
      keyMessaging: pageData.keyMessaging,
      screenshotPath
    };

  } catch (error) {
    console.error('Landing page scraping error:', error.message);
    await browser.close();
    return {
      error: error.message,
      url
    };
  }
}
