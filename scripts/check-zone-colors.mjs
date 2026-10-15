import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDocument } from '../shared/domain.js';

const root = path.resolve('.test-data');
await fs.mkdir(root, { recursive: true });
const directory = await fs.mkdtemp(path.join(root, 'colors-'));
const document = createDocument();
document.settings.labels = false;
document.settings.tileUrl = 'https://maps.test/{z}/{x}/{y}.png';
document.settings.tileAttribution = 'Mapa de prueba';
document.zones = [
  { id: 'outer', name: 'Zona azul', color: '#4285d4', price: 2200, active: true, description: '', priority: 0, ring: [[-60.55,-31.75],[-60.505,-31.75],[-60.505,-31.714],[-60.55,-31.714],[-60.55,-31.75]] },
  { id: 'inner', name: 'Zona roja', color: '#e23f40', price: 1500, active: true, description: '', priority: 1, ring: [[-60.535,-31.74],[-60.521,-31.74],[-60.521,-31.725],[-60.535,-31.725],[-60.535,-31.74]] },
];
const zonesFile = path.join(directory, 'zonas.json');
await fs.writeFile(zonesFile, JSON.stringify(document));
const env = { ...process.env, REPARTO_DATA_DIR: directory, REPARTO_TEST_HIDDEN: '1' };
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const errors = [], checks = [];
const check = (message) => { checks.push(message); console.log(`OK ${message}`); };
const expected = (hex, alpha) => hex.slice(1).match(/../g).map((s) => Math.round(255 * (1 - alpha) + parseInt(s, 16) * alpha));
const world = ([lng, lat], zoom) => {
  const size = 256 * 2 ** zoom, sin = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * size, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size];
};
async function point(coordinate) {
  const bounds = await page.locator('#map').boundingBox();
  const center = world([...document.settings.center].reverse(), document.settings.zoom);
  const projected = world(coordinate, document.settings.zoom);
  return { x: Math.round(bounds.x + bounds.width / 2 + projected[0] - center[0]), y: Math.round(bounds.y + bounds.height / 2 + projected[1] - center[1]) };
}
async function assertPixel(location, color, alpha, filename) {
  const buffer = await page.screenshot({ path: path.join(directory, filename) });
  const width = await page.evaluate(() => innerWidth);
  const actual = await app.evaluate(({ nativeImage }, { png, location, width }) => {
    const image = nativeImage.createFromBuffer(Buffer.from(png, 'base64'));
    const size = image.getSize(), bitmap = image.toBitmap(), scale = size.width / width;
    const index = (Math.round(location.y * scale) * size.width + Math.round(location.x * scale)) * 4;
    return [bitmap[index + 2], bitmap[index + 1], bitmap[index]];
  }, { png: buffer.toString('base64'), location, width });
  const wanted = expected(color, alpha);
  assert.ok(actual.every((value, i) => Math.abs(value - wanted[i]) <= 2), `Pixel ${JSON.stringify(location)}: expected ${wanted}, got ${actual}`);
}
async function settled() {
  await page.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('Todo guardado'));
  await page.waitForTimeout(250);
}
try {
  const config = process.env.REPARTO_PACKAGED ? { executablePath: path.resolve('entrega/win-unpacked/Reparto.exe'), args: [] } : { args: ['.'] };
  app = await electron.launch({ ...config, cwd: process.cwd(), env, timeout: 30000 });
  page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().route('https://maps.test/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/></svg>' }));
  await page.waitForSelector('#new-zone');
  // Packaged Windows builds need a visible compositor for fresh screenshots.
  // This window uses only the temporary fixture and does not take focus.
  if (process.env.REPARTO_PACKAGED) await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  await page.reload();
  await page.waitForSelector('[data-zone="inner"]');
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0 && document.querySelector('#map-alert').hidden);
  await settled();
  const inner = await point([-60.529, -31.735]);
  const outer = await point([-60.544, -31.735]);
  await assertPixel(inner, '#e23f40', 0.15, '01-colores.png');
  await assertPixel(outer, '#4285d4', 0.15, '01-colores.png');
  check('nested red and blue zones render their own unmixed colors over the map');
  await page.mouse.click(outer.x, outer.y);
  await page.waitForSelector('[data-zone="outer"].selected');
  await assertPixel(inner, '#e23f40', 0.15, '02-seleccion-exterior.png');
  check('selecting the outer zone does not paint over the inner zone');
  await page.mouse.click(inner.x, inner.y);
  await page.waitForSelector('[data-zone="inner"].selected');
  await assertPixel(inner, '#e23f40', 0.23, '03-seleccion-interior.png');
  check('clicking the overlap selects the zone whose color is visible');
  await page.locator('#deselect').click();
  await page.locator('#pin-mode').click();
  await page.mouse.click(inner.x, inner.y);
  await page.locator('#confirm-point').click();
  await page.waitForSelector('.result-card.covered');
  assert.match(await page.locator('.quote').textContent(), /Zona roja/);
  assert.match(await page.locator('.quote').textContent(), /1\.500/);
  check('delivery quote still uses the original zone and priority');
  await page.locator('#close-result').click();
  if (await page.locator('#pin-mode.is-active').count()) await page.locator('#pin-mode').click();
  await page.mouse.click(outer.x, outer.y);
  await page.locator('#edit-zone').click();
  const draftPath = page.locator('.leaflet-zoneFills-pane path[fill="#4285d4"]');
  assert.equal(await page.locator('.leaflet-zoneFills-pane path').count(), 1);
  assert.equal(await draftPath.count(), 1);
  assert.equal(await page.locator('.marker-icon:not(.marker-icon-middle)').count(), 4);
  await page.locator('[data-color="#177d68"]').click();
  assert.equal(await page.locator('.leaflet-zoneFills-pane path[fill="#177d68"]').count(), 1);
  await page.locator('#cancel-zone').click();
  await page.locator('#confirm-yes').click();
  await page.waitForSelector('#editor-pane', { state: 'hidden' });
  assert.equal(await page.locator('.leaflet-zoneFills-pane path').count(), 2);
  await page.locator('#home-map').click();
  await page.waitForTimeout(500);
  await page.locator('#deselect').click();
  await assertPixel(inner, '#e23f40', 0.15, '04-edicion-cancelada.png');
  assert.deepEqual(JSON.parse(await fs.readFile(zonesFile, 'utf8')).zones, document.zones);
  check('editing retains every vertex and previews one color; cancel restores saved fills');
  const output = path.join(directory, 'mapa-exportado.png');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, output);
  await page.locator('#export-map').click();
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('Imagen del mapa guardada'));
  const mapBounds = await page.locator('#map').boundingBox();
  const exportedPixel = await app.evaluate(async ({ nativeImage }, { output, inner, mapBounds }) => {
    const image = nativeImage.createFromPath(output), bitmap = image.toBitmap(), size = image.getSize();
    const scale = size.width / (Math.floor(mapBounds.width) - 1);
    const x = Math.round((inner.x - Math.ceil(mapBounds.x)) * scale), y = Math.round((inner.y - Math.ceil(mapBounds.y)) * scale);
    const index = (y * size.width + x) * 4;
    return [bitmap[index + 2], bitmap[index + 1], bitmap[index]];
  }, { output, inner, mapBounds });
  assert.ok(exportedPixel.every((channel, i) => Math.abs(channel - expected('#e23f40', 0.15)[i]) <= 2), `Exported pixel: ${exportedPixel}`);
  check('exported PNG also contains unmixed zone colors');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(root, 'colors-result.json'), JSON.stringify({ passed: checks.length, checks, errors, directory }, null, 2));
  console.log(`PASSED ${checks.length} color checks. ${directory}`);
} catch (error) {
  console.error(error);
  if (page) { await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => {}); }
  process.exitCode = 1;
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
