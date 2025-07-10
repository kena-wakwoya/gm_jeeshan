import { chromium } from 'playwright';
import { anonymizeProxy, closeAnonymizedProxy } from 'proxy-chain';
import { stripHtml } from 'string-strip-html'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function loginWithPlaywright({
  proxy,
  email,
  password,
  module
}) {
  let browser;
  let localProxy;
  try {
    // Anonymize SOCKS5 proxy
    const preProx = await prepareProxy(proxy);

    localProxy = await anonymizeProxy(preProx);
    browser = await chromium.launch({
      headless: true,
      proxy: { server: localProxy },
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Step 1: Go to login page
    await page.goto(module.login_url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        // Step 2: Handle cookie consent
    await handleCookiePopup(page);

    await handleRecaptcha(page);
    // Step 2: Fill login form dynamically from post_data
    let requiredFields = { email: false, password: false };
    const postFields = module.post_data.split('&');
    console.log(`[*] Filling login form with ${postFields.length} fields...`,postFields);
    const hasMultiform = module.multiform;
    console.log(`[*] Filling login form with ${postFields.length} fields...`,hasMultiform);
    // === MULTIFORM ===
if (hasMultiform) {
  // Step 1: Fill only email
  for (const field of postFields) {
    const [key, value] = field.split('=');
    if (key !== 'email') continue;

    const resolvedValue = value.replace('{email}', email);
    const locator = page.locator(`input[name="${key}"]`);
    try {
      await locator.fill(resolvedValue, { timeout: 4000 });
      requiredFields.email = true;
      console.log(`✅ Filled "${key}" field`);
    } catch (err) {
      console.warn(`⚠️ Could not fill "${key}" field: ${err.message}`);
    }
  }

  // Step 2: Click "Next" or "Continue" button
  try {
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")');
    await nextButton.click({ timeout: 4000 });
    console.log(`➡️ Clicked Next/Continue`);
  } catch (e) {
    console.warn(`⚠️ Could not click Next/Continue: ${e.message}`);
  }

  // Step 3: Fill password field
  for (const field of postFields) {
    const [key, value] = field.split('=');
    if (key !== 'password') continue;

    const resolvedValue = value.replace('{password}', password);
    const locator = page.locator(`input[name="${key}"]`);
    try {
      await locator.waitFor({ timeout: 8000 });
      await locator.fill(resolvedValue, { timeout: 4000 });
      requiredFields.password = true;
      console.log(`✅ Filled "${key}" field`);
    } catch (err) {
      console.warn(`⚠️ Could not fill "${key}" field: ${err.message}`);
    }
  }
}

// === SINGLE FORM ===
else {
    for (const field of postFields) {
      const [key, value] = field.split('=');
      const resolvedValue = value
        .replace('{email}', email)
        .replace('{password}', password);

      const selector = `input[name="${key}"]`;
      const locator = page.locator(selector);

      try {
        // Let Playwright handle waits automatically
        await locator.fill(resolvedValue, { timeout: 4000 });

        // Track required fields
        if (key === 'email') requiredFields.email = true;
        if (key === 'password') requiredFields.password = true;

        console.log(`✅ Filled "${key}" field`);
      } catch (err) {
        console.warn(`⚠️ Could not fill "${key}" field: ${err.message}`);
      }
    }
  }
    // Guard: Do not submit if email or password is missing
    if (!requiredFields.email || !requiredFields.password) {
      console.warn(`❌ Skipping form submission: required fields missing`);

      // // Optional: Screenshot for debugging
      // await page.screenshot({ path: `missing_fields_${email}.png` });

      // Optionally return or throw to mark combo as error
      return {
        status: 'error',
        contentSnippet: 'Missing required login fields'
      };
    }

    // Step 3: Click submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 90000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);

    // Step 4: Wait and read content
    await sleep(5000); // Extra wait after login
    const content = await page.content();

    // Step 5: Check success/fail/retry keywords and extract the sentence that contains the match
    console.log("success keys ", module.extra_data.success_key);
    console.log("fail keys ", module.extra_data.fail_key);
    console.log("retry keys ", module.extra_data.retry_key);

    const cleanText = stripHtml(content).result  // You can also use regex if you prefer
      .replace(/\s+/g, ' ')                      // Normalize whitespace
      .trim();

    // Break into sentences based on punctuation
    const sentences = cleanText.split(/(?<=[.?!])\s+/);

    let status = 'unknown';
    let matchedLine = null;

    // Try matching keyword from a key group (success, fail, retry)
    function findMatchingLine(keyString, type) {
      if (!keyString) return false;
      const keys = keyString.split(',').map(k => k.trim().toLowerCase());
      for (const sentence of sentences) {
        for (const key of keys) {
          if (sentence.toLowerCase().includes(key)) {
            matchedLine = sentence;
            status = type;
            return true;
          }
        }
      }
      return false;
    }

    // Priority order
    findMatchingLine(module.extra_data.success_key, 'success') ||
      findMatchingLine(module.extra_data.fail_key, 'fail') ||
      findMatchingLine(module.extra_data.retry_key, 'retry');

    return {
      status,
      contentSnippet: matchedLine || '[No sentence matched]'
    };

  } catch (err) {
    return { status: 'error', error: err.message };
  } finally {
    if (browser) await browser.close();
    if (localProxy) await closeAnonymizedProxy(localProxy);
  }
}


/**
 * Converts proxy string to Playwright-compatible proxy URL.
 * Supports both:
 * - "host:port:user:pass"
 * - "host:port"
 */
function prepareProxy(rawProxy) {
  const parts = rawProxy.trim().split(':');

  if (parts.length === 2) {
    // No auth: host:port
    const [host, port] = parts;
    return `socks5://${host}:${port}`;
  }

  if (parts.length === 4) {
    // With auth: host:port:user:pass
    const [host, port, username, password] = parts;
    return `socks5://${username}:${password}@${host}:${port}`;
  }

  throw new Error(`Invalid proxy format: expected host:port or host:port:user:pass, got "${rawProxy}"`);
}

async function waitForSelectorWithRetries(page, selector, timeout = 45000, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`⏳ [Attempt ${i + 1}] Waiting for selector: ${selector}`);
      await page.waitForSelector(selector, { timeout });
      console.log(`✅ Selector found: ${selector}`);
      return true; // success
    } catch (err) {
      console.warn(`⚠️  Attempt ${i + 1} failed: ${err.message}`);
      if (i === maxRetries - 1) throw new Error(`❌ Failed to find selector '${selector}' after ${maxRetries} attempts.`);
      await page.waitForTimeout(2000); // wait 2s before retry
    }
  }
}



// Accept cookie banners
async function handleCookiePopup(page) {
  try {
    const cookieButton = await page.$('text="Accept all"') || await page.$('text="Accept"') || await page.$('text="Agree"');
    if (cookieButton) {
      await cookieButton.click();
      console.log('[*] Cookie banner accepted');
      await page.waitForTimeout(10000);
    }
  } catch (e) {
    console.warn('[!] Cookie banner skip:', e.message);
  }
}

// Detect and solve reCAPTCHA using 2Captcha
async function handleRecaptcha(page) {
  try {
    const hasRecaptcha = await page.$('iframe[src*="recaptcha"]');
    if (!hasRecaptcha) return;

    const siteKey = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="recaptcha"]');
      const src = iframe?.getAttribute('src');
      const match = src?.match(/k=([0-9A-Za-z_-]+)/);
      return match ? match[1] : null;
    });

    if (!siteKey) {
      console.log('[*] No sitekey found');
      return;
    }

    console.log('[*] Solving CAPTCHA via 2Captcha...');
    const token = await solveRecaptchaToken({ siteKey, url: page.url() });
    
    // Inject into textarea
    await page.evaluate(token => {
      const textarea = document.createElement('textarea');
      textarea.name = 'g-recaptcha-response';
      textarea.style.display = 'none';
      textarea.value = token;
      document.body.appendChild(textarea);
    }, token);

    console.log('[*] CAPTCHA solved and injected.');
  } catch (err) {
    console.warn('[!] reCAPTCHA handling error:', err.message);
  }
}

// Solve reCAPTCHA using 2Captcha
async function solveRecaptchaToken({ siteKey, url }) {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey) throw new Error('2Captcha API key not set');

  const { data } = await axios.get('http://2captcha.com/in.php', {
    params: {
      key: apiKey,
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: url,
      json: 1
    }
  });

  if (data.status !== 1) throw new Error('2Captcha task submit failed');

  const requestId = data.request;
  console.log('[*] CAPTCHA submitted, polling...');

  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const { data: poll } = await axios.get('http://2captcha.com/res.php', {
      params: {
        key: apiKey,
        action: 'get',
        id: requestId,
        json: 1
      }
    });
    if (poll.status === 1) {
      return poll.request;
    } else if (poll.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2Captcha error: ${poll.request}`);
    }
  }

  throw new Error('2Captcha solve timeout');
}