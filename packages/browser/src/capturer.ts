import { chromium, type Browser, type Page } from 'playwright';
import { BROWSER_DEFAULTS } from '@pagepulse/config';
import { validateUrlSsrf } from '@pagepulse/core';

export interface PageCaptureOptions {
  url: string;
  includeSelectors?: string[];
  ignoreSelectors?: string[];
  timeoutMs?: number;
  viewport?: { width: number; height: number };
}

export interface PageCaptureResult {
  httpStatus: number | null;
  finalUrl: string;
  pageTitle: string;
  rawText: string;
  selectedText: string;
  htmlContent: string;
  screenshotPng: Buffer;
  durationMs: number;
  errorMessage?: string | null;
  responseHeaders: Record<string, string>;
}

export interface IPageCapturer {
  capture(options: PageCaptureOptions): Promise<PageCaptureResult>;
  close(): Promise<void>;
}

export class PlaywrightCapturer implements IPageCapturer {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--hide-scrollbars',
          '--mute-audio',
        ],
      });
    }
    return this.browser;
  }

  async capture(options: PageCaptureOptions): Promise<PageCaptureResult> {
    const startTime = Date.now();
    const timeout = options.timeoutMs ?? BROWSER_DEFAULTS.TIMEOUT_MS;
    const viewport = options.viewport ?? BROWSER_DEFAULTS.VIEWPORT;

    // Pre-flight SSRF check
    const ssrfCheck = validateUrlSsrf(options.url);
    if (!ssrfCheck.safe) {
      return {
        httpStatus: null,
        finalUrl: options.url,
        pageTitle: '',
        rawText: '',
        selectedText: '',
        htmlContent: '',
        screenshotPng: Buffer.alloc(0),
        durationMs: Date.now() - startTime,
        errorMessage: `Blocked by SSRF Policy: ${ssrfCheck.reason}`,
        responseHeaders: {},
      };
    }

    let page: Page | null = null;
    let context = null;

    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({
        viewport,
        locale: BROWSER_DEFAULTS.LOCALE,
        timezoneId: BROWSER_DEFAULTS.TIMEZONE,
        colorScheme: BROWSER_DEFAULTS.COLOR_SCHEME,
        userAgent: BROWSER_DEFAULTS.USER_AGENT,
      });

      page = await context.newPage();
      page.setDefaultNavigationTimeout(timeout);
      page.setDefaultTimeout(timeout);

      // Route interceptor to validate every request & redirect against SSRF
      await page.route('**/*', (route) => {
        const reqUrl = route.request().url();
        const check = validateUrlSsrf(reqUrl);
        if (!check.safe) {
          route.abort('blockedbyclient');
        } else {
          route.continue();
        }
      });

      let httpStatus: number | null = null;
      const responseHeaders: Record<string, string> = {};

      const response = await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });

      if (response) {
        httpStatus = response.status();
        const headers = response.headers();
        for (const [k, v] of Object.entries(headers)) {
          responseHeaders[k.toLowerCase()] = v;
        }
      }

      // Inject stabilization styles to freeze animations and hide blinking carets
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            transition: none !important;
            animation: none !important;
            caret-color: transparent !important;
          }
        `,
      });

      const finalUrl = page.url();
      const pageTitle = await page.title();
      const htmlContent = await page.content();

      // Extract raw body text
      const rawText = (await page.evaluate(() => document.body?.innerText || '')) || '';

      // Mask or hide ignore selectors before taking screenshot and extracting text
      if (options.ignoreSelectors && options.ignoreSelectors.length > 0) {
        for (const selector of options.ignoreSelectors) {
          try {
            await page.evaluate((sel) => {
              const elements = Array.from(document.querySelectorAll(sel));
              for (const el of elements) {
                (el as HTMLElement).style.visibility = 'hidden';
              }
            }, selector);
          } catch {
            // Ignore invalid selector during evaluation
          }
        }
      }

      // Extract selected text
      let selectedText = rawText;
      if (options.includeSelectors && options.includeSelectors.length > 0) {
        const extractedParts: string[] = [];
        for (const selector of options.includeSelectors) {
          try {
            const texts = await page.evaluate((sel) => {
              const elements = document.querySelectorAll(sel);
              return Array.from(elements).map((el) => (el as HTMLElement).innerText || '');
            }, selector);
            extractedParts.push(...texts);
          } catch {
            // Ignore missing selector
          }
        }
        if (extractedParts.length > 0) {
          selectedText = extractedParts.join('\n');
        }
      }

      // Capture screenshot
      const screenshotPng = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      return {
        httpStatus,
        finalUrl,
        pageTitle,
        rawText,
        selectedText,
        htmlContent,
        screenshotPng,
        durationMs: Date.now() - startTime,
        responseHeaders,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        httpStatus: null,
        finalUrl: options.url,
        pageTitle: '',
        rawText: '',
        selectedText: '',
        htmlContent: '',
        screenshotPng: Buffer.alloc(0),
        durationMs: Date.now() - startTime,
        errorMessage: error.message || 'Unknown browser navigation error',
        responseHeaders: {},
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

/**
 * Mock Page Capturer for unit and integration testing without requiring Chromium binary.
 */
export class MockCapturer implements IPageCapturer {
  public fixtureResponses = new Map<string, Partial<PageCaptureResult>>();

  setFixture(url: string, result: Partial<PageCaptureResult>): void {
    this.fixtureResponses.set(url, result);
  }

  async capture(options: PageCaptureOptions): Promise<PageCaptureResult> {
    const ssrfCheck = validateUrlSsrf(options.url);
    if (!ssrfCheck.safe) {
      return {
        httpStatus: null,
        finalUrl: options.url,
        pageTitle: '',
        rawText: '',
        selectedText: '',
        htmlContent: '',
        screenshotPng: Buffer.alloc(0),
        durationMs: 5,
        errorMessage: `Blocked by SSRF Policy: ${ssrfCheck.reason}`,
        responseHeaders: {},
      };
    }

    const fixture = this.fixtureResponses.get(options.url);
    if (fixture) {
      return {
        httpStatus: fixture.httpStatus ?? 200,
        finalUrl: fixture.finalUrl ?? options.url,
        pageTitle: fixture.pageTitle ?? 'Fixture Page Title',
        rawText: fixture.rawText ?? 'Fixture page content',
        selectedText: fixture.selectedText ?? fixture.rawText ?? 'Fixture page content',
        htmlContent: fixture.htmlContent ?? '<html><body>Fixture page content</body></html>',
        screenshotPng: fixture.screenshotPng ?? Buffer.alloc(100),
        durationMs: fixture.durationMs ?? 15,
        errorMessage: fixture.errorMessage ?? null,
        responseHeaders: fixture.responseHeaders ?? {},
      };
    }

    return {
      httpStatus: 200,
      finalUrl: options.url,
      pageTitle: 'Default Mock Page',
      rawText: 'Default page body text',
      selectedText: 'Default page body text',
      htmlContent: '<html><body>Default page body text</body></html>',
      screenshotPng: Buffer.alloc(100),
      durationMs: 10,
      responseHeaders: {},
    };
  }

  async close(): Promise<void> {}
}
