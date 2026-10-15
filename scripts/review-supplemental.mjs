// One ordinary live viewport for visual review; never uses the operator's data.
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDocument } from '../shared/domain.js';

const directory = await fs.mkdtemp(path.resolve('.test-data/street-review-'));
const document = createDocument();
document.settings.center = [-31.787737135, -60.49701873]; document.settings.zoom = 17;
await fs.writeFile(path.join(directory, 'zonas.json'), JSON.stringify(document));
const env = { ...process.env, REPARTO_DATA_DIR: directory, REPARTO_TEST_HIDDEN: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const config = process.env.REPARTO_PACKAGED ? { executablePath: path.resolve('entrega/win-unpacked/Reparto.exe'), args: [] } : { args: ['.'] };
const app = await electron.launch({ ...config, env, cwd: process.cwd(), timeout: 30000 });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('#new-zone');
  await app.evaluate(({ BrowserWindow, session }) => {
    session.defaultSession.webRequest.onBeforeRequest(null);
    BrowserWindow.getAllWindows()[0].showInactive();
  });
  await page.reload(); await page.waitForSelector('#new-zone');
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0 && document.querySelector('#map-alert').hidden, {}, { timeout: 30000 });
  await page.locator('#address').fill('893 y 868'); await page.locator('#search-button').click();
  await page.waitForSelector('#result-card:visible');
  await page.waitForSelector('.supplemental-street-name[data-street="300841600002220"]');
  await page.waitForSelector('.supplemental-street-name[data-street="300841600002230"]');
  await page.waitForTimeout(800);
  assert.ok(await page.locator('.leaflet-tile-loaded').count());
  const screenshot = path.join(directory, 'Calles-893-y-868.png');
  await page.screenshot({ path: screenshot });
  console.log(JSON.stringify({ screenshot, loadedTiles: await page.locator('.leaflet-tile-loaded').count() }));
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
