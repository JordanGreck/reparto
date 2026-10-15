import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDocument, locateZone } from '../shared/domain.js';
import { Geocoder } from '../shared/geocoder.js';

const root = path.resolve('.test-data');
await fs.mkdir(root, { recursive: true });
const directory = await fs.mkdtemp(path.join(root, 'supplemental-'));
let document;
try { document = JSON.parse(await fs.readFile(path.join(root, 'calles-baseline/zonas.json'), 'utf8')); }
catch { document = createDocument(); }
const savedZones = JSON.stringify(document.zones);
const corner = (await new Geocoder().search('893 y 868', document.settings)).results[0];
const match = locateZone([corner.lon, corner.lat], document.zones);
document.settings.center = [corner.lat, corner.lon];
document.settings.zoom = 17;
document.settings.tileUrl = 'https://maps.test/{z}/{x}/{y}.png';
document.settings.tileAttribution = 'Mapa sintético de prueba';
const initial = JSON.stringify(document, null, 2);
const zonesFile = path.join(directory, 'zonas.json');
await fs.writeFile(zonesFile, initial);
const env = { ...process.env, REPARTO_DATA_DIR: directory, REPARTO_TEST_HIDDEN: '1' };
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const checks = [], errors = [];
const check = (message) => { checks.push(message); console.log(`OK ${message}`); };
async function query(text) { await page.locator('#address').fill(text); await page.locator('#search-button').click(); }
try {
  const config = process.env.REPARTO_PACKAGED ? { executablePath: path.resolve('entrega/win-unpacked/Reparto.exe'), args: [] } : { args: ['.'] };
  app = await electron.launch({ ...config, env, cwd: process.cwd(), timeout: 30000 });
  page = await app.firstWindow(); page.on('pageerror', (e) => errors.push(e.message));
  await page.context().route('https://maps.test/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eee3"/></svg>' }));
  await page.waitForSelector('#new-zone');
  if (process.env.REPARTO_PACKAGED) await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  await page.reload(); await page.waitForSelector('#new-zone');
  await page.waitForSelector('.supplemental-street-name[data-street="300841600002220"]');
  await page.waitForSelector('.supplemental-street-name[data-street="300841600002230"]');
  assert.match(await page.locator('.leaflet-control-attribution').textContent(), /Georef/);
  assert.equal(await page.locator('[data-zone]').count(), document.zones.length);
  check('new street labels and attribution appear with the existing service zones');
  await page.screenshot({ path: path.join(directory, '01-calles-nuevas.png') });

  await query('Calle 893'); await page.waitForSelector('#confirm-point');
  assert.equal(await page.locator('.quote:visible').count(), 0);
  assert.match(await page.locator('#result-card').textContent(), /no un domicilio/);
  await query('Calle 868 100'); await page.waitForSelector('#confirm-point');
  assert.equal(await page.locator('.quote:visible').count(), 0);
  assert.match(await page.locator('#result-card').textContent(), /no hay una ubicación verificada/);
  check('street names and unverified heights require confirmation before quoting');

  await query('893 y 868'); await page.waitForSelector('#result-card:visible');
  assert.equal(await page.locator('#confirm-point').count(), 0);
  assert.match(await page.locator('#result-card h3').textContent(), /868/);
  assert.match(await page.locator('#result-card h3').textContent(), /893/);
  if (match.status !== 'unconfigured' && match.status !== 'conflict') assert.match(await page.locator('.result-source').textContent(), /Georef/);
  if (match.status === 'inside') {
    assert.ok(await page.locator('.quote:visible').count());
    const expected = new Intl.NumberFormat('es-AR', { style: 'currency', currency: document.settings.currency, maximumFractionDigits: Number.isInteger(match.zone.price) ? 0 : 2 }).format(match.zone.price);
    assert.equal((await page.locator('.quote strong').textContent()).replace(/\s/g, ''), expected.replace(/\s/g, ''));
  }
  check('the new intersection uses the original zone geometry, priority and price');
  await page.screenshot({ path: path.join(directory, '02-busqueda-cruce.png') });

  await query('893 y Grella'); await page.waitForSelector('#manual-address');
  assert.equal(await page.locator('.result-card.outside:visible').count(), 0);
  check('missing intersections still offer manual placement instead of false outside-coverage results');
  await query('Grella y Alcorta'); await page.waitForSelector('#result-card:visible');
  assert.match(await page.locator('#result-card h3').textContent(), /Grella/);
  assert.equal(await page.locator('#confirm-point').count(), 0);
  check('the original abbreviated intersection search still works');

  await page.locator('#new-zone').click(); await page.waitForSelector('#cancel-zone');
  await page.locator('#cancel-zone').click();
  await page.locator('#confirm-yes').click();
  await page.waitForSelector('#editor-pane', { state: 'hidden' });
  assert.equal(await page.locator('[data-zone]').count(), document.zones.length);
  assert.equal(await fs.readFile(zonesFile, 'utf8'), initial);
  await page.reload(); await page.waitForSelector('#new-zone');
  assert.equal(await page.locator('[data-zone]').count(), document.zones.length);
  assert.equal(JSON.stringify(JSON.parse(await fs.readFile(zonesFile, 'utf8')).zones), savedZones);
  check('searching, canceling a drawing and reopening leave saved zones and settings unchanged');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(root, 'supplemental-result.json'), JSON.stringify({ passed: checks.length, checks, errors, packaged: Boolean(process.env.REPARTO_PACKAGED), preservedZones: document.zones.length, directory }, null, 2));
  console.log(`PASSED ${checks.length} supplemental street checks. ${directory}`);
} catch (error) {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(directory, 'failure.png'), timeout: 5000 }).catch(() => {});
  process.exitCode = 1;
} finally { if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
