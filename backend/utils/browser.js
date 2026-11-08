import { chromium as playwrightChromium } from "playwright";
import serverlessChromium from "@sparticuz/chromium";

/**
 * Launch the browser used by Inspectra.
 *
 * Local development:
 *   Uses the browser installed by `npx playwright install chromium`.
 *
 * Vercel:
 *   Uses the Linux Chromium binary packaged for serverless functions.
 */
export async function launchBrowser(options = {}) {
  if (process.env.VERCEL === "1") {
    const executablePath = await serverlessChromium.executablePath();

    return playwrightChromium.launch({
      args: serverlessChromium.args,
      executablePath,
      headless: true,
      ...options,
    });
  }

  return playwrightChromium.launch({
    headless: true,
    ...options,
  });
}
