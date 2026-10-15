import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDocument, locateZone, money } from '../shared/domain.js';
import { Geocoder } from '../shared/geocoder.js';

const root = path.resolve('.test-data');
const directory = await fs.mkdtemp(path.join(root, 'sector-check-'));
let document;
try { document = JSON.parse(await fs.readFile(path.join(root, 'sector-crausaz-baseline/zonas.json'), 'utf8')); }
catch { document = createDocument(); }
const savedZones = JSON.stringify(document.zones);
document.settings.center = [-31.767, -60.5375]; document.settings.zoom = 17;
document.settings.tileUrl = 'https://maps.test/{z}/{x}/{y}.png';
document.settings.tileAttribution = 'Mapa sintético de prueba';
const initial = JSON.stringify(document, null, 2), zonesFile = path.join(directory, 'zonas.json');
await fs.writeFile(zonesFile, initial);
const env = { ...process.env, REPARTO_DATA_DIR: directory, REPARTO_TEST_HIDDEN: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const config = process.env.REPARTO_PACKAGED ? { executablePath: path.resolve('entrega/win-unpacked/Reparto.exe'), args: [] } : { args: ['.'] };
const checks = [], errors = [];
let app, page;
const check = (message) => { checks.push(message); console.log(`OK ${message}`); };
async function query(text, expected) {
  await page.locator('#address').fill(text); await page.locator('#search-button').click();
  if (expected) await page.waitForFunction((name) => document.querySelector('#result-card h3')?.textContent.includes(name), expected);
}
try {
  app = await electron.launch({ ...config, env, cwd: process.cwd(), timeout: 30000 });
  page = await app.firstWindow(); page.on('pageerror', (e) => errors.push(e.message));
  await page.context().route('https://maps.test/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eee3"/></svg>' }));
  await page.waitForSelector('#new-zone');
  if (process.env.REPARTO_PACKAGED) await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  await page.reload(); await page.waitForSelector('#new-zone');
  await query('1666 y Sors', 'Calle 1666');
  await page.waitForSelector('.supplemental-street-name[data-street="sector:346723367"]');
  await page.waitForSelector('.supplemental-street-name[data-street="sector:219905572"]');
  assert.equal(await page.locator('[data-zone]').count(), document.zones.length);
  check('1666 and Sors labels appear with all saved zones');
  await page.screenshot({ path: path.join(directory, '01-nombres-sector.png') });

  for (const text of ['1666 y Sors', 'Greca y Sors', '1855 y 1165']) {
    const result = (await new Geocoder().search(text, document.settings)).results[0];
    await query(text, result.label);
    assert.equal(await page.locator('#confirm-point').count(), 0);
    const match = locateZone([result.lon, result.lat], document.zones);
    if (match.status === 'inside') {
      assert.equal((await page.locator('.quote strong').textContent()).replace(/\s/g, ''), money(match.zone.price, document.settings.currency).replace(/\s/g, ''));
      assert.match(await page.locator('.quote-zone').textContent(), new RegExp(match.zone.name));
    }
  }
  await page.waitForSelector('.supplemental-street-name[data-street="sector:677296929"]');
  await page.waitForSelector('.supplemental-street-name[data-street="sector:677296932"]');
  check('new northern and southern corners use existing zone boundaries and tariffs');
  await page.screenshot({ path: path.join(directory, '02-sector-sur.png') });

  for (const text of ['Sors', 'Calle 1663', '1666 1200']) {
    const expected = (await new Geocoder().search(text, document.settings)).results[0];
    await query(text, expected.label); await page.waitForSelector('#confirm-point');
    assert.equal(await page.locator('.quote:visible').count(), 0);
  }
  check('street-only and unverified house-number results still require confirmation');
  await query('1853 y 1855'); await page.waitForSelector('#manual-address');
  assert.equal(await page.locator('.result-card.outside:visible').count(), 0);
  check('parallel streets are not treated as a corner or as outside coverage');
  await query('Grella y Alcorta', 'Grella');
  assert.equal(await page.locator('#confirm-point').count(), 0);
  await query('893 y 868', '893');
  assert.equal(await page.locator('#confirm-point').count(), 0);
  check('previous abbreviated and numbered intersections remain usable');
  await page.locator('#new-zone').click(); await page.waitForSelector('#cancel-zone');
  await page.locator('#cancel-zone').click(); await page.locator('#confirm-yes').click();
  await page.waitForSelector('#editor-pane', { state: 'hidden' });
  assert.equal(await fs.readFile(zonesFile, 'utf8'), initial);
  await page.reload(); await page.waitForSelector('#new-zone');
  assert.equal(JSON.stringify(JSON.parse(await fs.readFile(zonesFile, 'utf8')).zones), savedZones);
  assert.equal(await fs.readFile(zonesFile, 'utf8'), initial);
  assert.deepEqual(errors, []);
  check('searching, canceling an edit and reopening preserve zones, colors, prices and settings');
  await fs.writeFile(path.join(root, 'sector-result.json'), JSON.stringify({ passed: checks.length, checks, errors, packaged: Boolean(process.env.REPARTO_PACKAGED), preservedZones: document.zones.length, directory }, null, 2));
  console.log(`PASSED ${checks.length} sector checks. ${directory}`);
} catch (e) {
  console.error(e); process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(directory, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally { if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
