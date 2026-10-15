import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDocument } from '../shared/domain.js';
import { IntersectionSearch } from '../shared/intersections.js';
import catalog from '../assets/parana-streets.json' with { type: 'json' };

const root = path.resolve('.test-data');
await fs.mkdir(root, { recursive: true });
const directory = await fs.mkdtemp(path.join(root, 'intersections-'));
const document = createDocument(), search = new IntersectionSearch();
const corner = search.search('Grella y Alcorta', document.settings).results[0];
assert.ok(corner);
document.settings.center = [corner.lat, corner.lon];
document.settings.zoom = 16;
document.settings.tileUrl = 'https://maps.test/{z}/{x}/{y}.png';
document.settings.tileAttribution = 'Mapa sintético de prueba';
const { lat, lon } = corner, margin = 0.002;
document.zones = [{ id: 'test', name: 'Zona de prueba', active: true, color: '#177d68', price: 1800, priority: 0, description: '', ring: [[lon-margin,lat-margin],[lon+margin,lat-margin],[lon+margin,lat+margin],[lon-margin,lat+margin],[lon-margin,lat-margin]] }];
await fs.writeFile(path.join(directory, 'zonas.json'), JSON.stringify(document));
const env = { ...process.env, REPARTO_DATA_DIR: directory, REPARTO_TEST_HIDDEN: '1' };
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const checks = [], errors = [];
const check = (name) => { checks.push(name); console.log(`OK ${name}`); };
async function query(text) {
  await page.locator('#address').fill(text);
  await page.locator('#search-button').click();
}
try {
  const config = process.env.REPARTO_PACKAGED ? { executablePath: path.resolve('entrega/win-unpacked/Reparto.exe'), args: [] } : { args: ['.'] };
  app = await electron.launch({ ...config, env, cwd: process.cwd(), timeout: 30000 });
  page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().route('https://maps.test/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf1e7"/><path d="M0 128H256M128 0V256" stroke="white" stroke-width="10"/></svg>' }));
  await page.waitForSelector('#new-zone');
  if (process.env.REPARTO_PACKAGED) await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  await page.reload();
  await page.waitForSelector('#new-zone');
  await query('Grella y Alcorta');
  await page.waitForSelector('.result-card.covered');
  assert.match(await page.locator('.result-card h3').textContent(), /Grella/);
  assert.match(await page.locator('.result-card h3').textContent(), /Alcorta/);
  assert.match(await page.locator('.quote').textContent(), /1\.800/);
  assert.match(await page.locator('.result-source').textContent(), /Intersección identificada/);
  assert.equal(await page.locator('#confirm-point').count(), 0);
  check('Grella y Alcorta locates the actual shared node and calculates its zone price');
  for (const text of ['Alcorta y Grella', 'GRELLA ESQUINA ALCORTA', corner.label]) {
    await query(text); await page.waitForSelector('.result-card.covered');
    assert.match(await page.locator('.quote').textContent(), /1\.800/);
  }
  check('reversed streets, uppercase, esquina and full names reach the same corner');
  const pin = await page.locator('.address-marker').boundingBox();
  await page.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2);
  await page.mouse.down(); await page.mouse.move(pin.x + pin.width / 2 + 15, pin.y + pin.height / 2 + 10, { steps: 8 }); await page.mouse.up();
  await page.waitForSelector('#confirm-point');
  assert.equal(await page.locator('.quote:visible').count(), 0);
  await page.locator('#confirm-point').click(); await page.waitForSelector('.result-card.covered');
  check('moving a located intersection requires confirming the new point before quoting');
  await query('CalleInexistentezz y OtraInexistentezz');
  await page.waitForSelector('#manual-address');
  assert.match(await page.locator('#search-results').textContent(), /No encontramos esa intersección/);
  assert.equal(await page.locator('.result-card.outside:visible').count(), 0);
  check('missing intersection offers manual placement without reporting outside coverage');
  let ambiguous;
  for (const candidate of catalog.intersections) {
    const names = candidate.streets.slice(0, 2).map((id) => catalog.streets[id].name.split(' ').at(-1));
    try { const found = search.search(names.join(' y '), document.settings); if (found?.results.length > 1 && new Set(found.results.map((r) => r.label)).size > 1) { ambiguous = names.join(' y '); break; } } catch {}
  }
  assert.ok(ambiguous, 'Expected at least one ambiguous surname query in the city catalog');
  await query(ambiguous); await page.waitForSelector('[data-candidate]');
  assert.match(await page.locator('.candidate-heading').textContent(), /intersección/);
  assert.ok(await page.locator('[data-candidate]').count() > 1);
  assert.equal(await page.locator('.quote:visible').count(), 0);
  await page.locator('[data-candidate]').first().click();
  await page.waitForSelector('.result-card:visible');
  check('ambiguous abbreviated names show options and wait for the user to choose');
  await query('Grella y Alcorta'); await page.waitForSelector('.result-card.covered');
  await page.screenshot({ path: path.join(directory, 'Grella-y-Alcorta.png') });
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'zonas.json'), 'utf8')).zones, document.zones);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(root, 'intersections-result.json'), JSON.stringify({ passed: checks.length, checks, errors, packaged: Boolean(process.env.REPARTO_PACKAGED), corner, directory }, null, 2));
  console.log(`PASSED ${checks.length} intersection checks. ${directory}`);
} catch (error) {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(directory, 'failure.png'), timeout: 5000 }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
