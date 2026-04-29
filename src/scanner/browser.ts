import { chromium, Browser, BrowserContext, Page } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(headless = true, viewport = { width: 1280, height: 720 }) {
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext({ viewport });
    return this;
  }

  async newPage(): Promise<Page> {
    if (!this.context) throw new Error('Browser not launched');
    return this.context.newPage();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
  }
}
