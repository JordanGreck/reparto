import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createDocument, normalize, locateZone } from '../shared/domain.js';

const root = path.resolve('.test-data');
await fs.mkdir(root, { recursive: true });
const testDir = await fs.mkdtemp(path.join(root, 'desktop-'));
const settings = createDocument().settings;
const samples = [
  ['Prueba 100', -31.733, -60.529, 'address'],
  ['Lejos 100', -31.80, -60.40, 'address'],
  ['Aproximada 100', -31.733, -60.529, 'approximate'],
  ['No Existe 100', null, null, 'address']
];
const cache = {};
for (const [query, lat, lon, precision] of samples) {
  const key = JSON.stringify([normalize(query), settings.city, settings.province, settings.countryCode, settings.geocoderUrl]);
  cache[key] = { time: Date.now(), value: { results: lat === null ? [] : [{ lat, lon, label: query, detail: 'Dirección sintética de prueba, Paraná, Entre Ríos', precision, reason: 'Ubicación aproximada para la prueba.', query }], cached: true } };
}
await fs.writeFile(path.join(testDir, 'direcciones-cache.json'), JSON.stringify(cache));
const env = { ...process.env, REPARTO_DATA_DIR: testDir, REPARTO_TEST_HIDDEN: '1' }; delete env.ELECTRON_RUN_AS_NODE;
let app;
const errors = [];
const checks = [];
const check = (name) => { checks.push(name); console.log(`OK ${name}`); };
async function launch() {
  const config = process.env.REPARTO_PACKAGED ? {executablePath:path.resolve('entrega/win-unpacked/Reparto.exe'),args:[]} : {args:['.']};
  app = await electron.launch({ ...config, cwd: process.cwd(), env, timeout: 30000 });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('#new-zone', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('Todo guardado'));
  return page;
}
async function saved(page) { await page.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('Todo guardado')); }
async function close() { await app.evaluate(({ app }) => app.exit(0)); }
try {
  let page = await launch();
  check('ventana real de escritorio y persistencia inicial');
  await page.locator('#new-zone').click();
  await page.locator('#zone-name').fill('Centro de prueba');
  await page.locator('#zone-price').fill('1500.50');
  const rect = await page.locator('#map').boundingBox();
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  for (const [x,y] of [[cx-130,cy-110],[cx+130,cy-110],[cx+130,cy+20],[cx-130,cy+20]]) await page.mouse.click(x,y);
  await page.locator('#draw-finish').click();
  await page.getByRole('button', { name: 'Guardar zona', exact: true }).click();
  await page.waitForSelector('[data-zone]'); await saved(page);
  const file = path.join(testDir,'zonas.json');
  let document = JSON.parse(await fs.readFile(file,'utf8'));
  assert.equal(document.zones.length,1); assert.equal(document.zones[0].price,1500.50);
  assert.equal(locateZone([-60.529,-31.733],document.zones).status,'inside');
  check('dibujar contorno, asignar nombre y precio, guardar');
  await page.locator('#address').fill('Prueba 100'); await page.locator('#search-button').click();
  await page.waitForSelector('.result-card.covered');
  assert.match(await page.locator('.quote').textContent(),/1\.500,50/); check('dirección dentro de zona muestra tarifa');
  await page.locator('#close-result').click();
  await page.locator('#edit-zone').click();
  await page.locator('#zone-price').fill('2100');
  await page.getByRole('button', {name:'Guardar zona',exact:true}).click(); await saved(page);
  await page.locator('#address').fill('Prueba 100');await page.locator('#search-button').click();await page.waitForSelector('.result-card.covered');
  assert.match(await page.locator('.quote').textContent(),/2\.100/);check('edición de precio actualiza consultas posteriores');
  await page.locator('#address').fill('Lejos 100');await page.locator('#search-button').click();await page.waitForSelector('.result-card.outside');check('dirección localizada fuera de cobertura');
  await page.locator('#address').fill('Aproximada 100');await page.locator('#search-button').click();await page.waitForSelector('#confirm-point');
  assert.equal(await page.locator('.quote').count(),0);await page.locator('#confirm-point').click();await page.waitForSelector('.result-card.covered');check('ubicación aproximada exige confirmación antes de cotizar');
  await page.locator('#address').fill('No Existe 100');await page.locator('#search-button').click();await page.waitForSelector('#manual-address');
  assert.match(await page.locator('#search-results').textContent(),/No encontramos/);assert.equal(await page.locator('.result-card.outside:visible').count(),0);check('dirección inexistente no se confunde con fuera de zona');
  await page.locator('#address').fill('Sin altura');await page.locator('#search-button').click();await page.waitForFunction(()=>document.querySelector('#search-results')?.textContent.includes('Agregá la altura'));check('dirección incompleta se rechaza');
  await page.locator('#undo').click();await saved(page);document=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(document.zones[0].price,1500.50);
  await page.locator('#redo').click();await saved(page);document=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(document.zones[0].price,2100);check('deshacer y rehacer persisten los precios');
  await page.locator('[data-zone]').click();await page.locator('#edit-zone').click();
  const handles = page.locator('.leaflet-marker-icon.marker-icon:not(.marker-icon-middle)');
  assert.ok(await handles.count()>=4);
  await handles.first().hover();
  await page.waitForTimeout(500);
  const first = await handles.first().boundingBox();
  await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();await page.mouse.move(first.x+first.width/2-35,first.y+first.height/2-25,{steps:10});await page.mouse.up();
  await page.waitForTimeout(150);
  await page.getByRole('button',{name:'Guardar zona',exact:true}).click();await saved(page);
  const edited=JSON.parse(await fs.readFile(file,'utf8'));assert.notDeepEqual(edited.zones[0].ring,document.zones[0].ring);check('arrastrar vértices cambia el contorno guardado');
  const backup=path.join(testDir,'respaldo.json');
  await app.evaluate(({dialog}, filePath)=> { dialog.showSaveDialog=async()=>({canceled:false,filePath}); },backup);
  await page.locator('#backup-menu').click();await page.locator('#export-backup').click();
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Copia de seguridad guardada'));
  assert.deepEqual(JSON.parse(await fs.readFile(backup,'utf8')),edited);check('exportar respaldo completo');
  await app.evaluate(({dialog}, filePath)=> {dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]});dialog.showMessageBox=async()=>({response:1});},backup);
  await page.locator('#import-backup').click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Respaldo restaurado'));
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),edited);check('importar respaldo validado y conservar copia anterior');
  await page.locator('[data-zone]').click();await page.locator('#delete-zone').click();await page.locator('#confirm-yes').click();await page.waitForFunction(()=>document.querySelector('#zone-total')?.textContent==='0');await saved(page);
  assert.equal(JSON.parse(await fs.readFile(file,'utf8')).zones.length,0);await page.locator('#undo').click();await saved(page);check('eliminar zona y recuperarla con deshacer');
  await page.locator('#settings').click();await page.locator('[name=business]').fill('Local de prueba');await page.getByRole('button',{name:'Guardar configuración'}).click();await saved(page);
  await page.context().route('https://maps.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf1e7"/><path d="M0 128H256M128 0V256" stroke="#fff" stroke-width="10"/></svg>'}));
  await page.locator('#settings').click();await page.locator('#settings-form details').evaluate(el=>el.open=true);await page.locator('[name=tileUrl]').fill('https://maps.test/{z}/{x}/{y}.png');await page.locator('[name=tileAttribution]').fill('Mapa sintético de prueba');await page.getByRole('button',{name:'Guardar configuración'}).click();await saved(page);
  await page.waitForFunction(()=>document.querySelector('#map-alert').hidden);
  const exportedMap=path.join(testDir,'mapa-prueba.png');await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},exportedMap);
  await page.locator('#export-map').click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Imagen del mapa guardada'));
  const png=await fs.readFile(exportedMap);assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>1000);check('exportación PNG del mapa visible y su leyenda');
  await page.screenshot({path:path.join(testDir,'interfaz-prueba.png')});
  await close();page=await launch();
  assert.equal(await page.locator('#business').textContent(),'Local de prueba');assert.equal(await page.locator('[data-zone]').count(),1);check('cerrar y reabrir conserva zonas y configuración');
  const isolated=await app.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {contextIsolation:p.contextIsolation,sandbox:p.sandbox,nodeIntegration:p.nodeIntegration};});
  assert.deepEqual(isolated,{contextIsolation:true,sandbox:true,nodeIntegration:false});check('ventana con aislamiento y sandbox activos');
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(root,'desktop-result.json'),JSON.stringify({passed:checks.length,checks,errors,dataDirectory:testDir},null,2));
  console.log(`PASSED ${checks.length} desktop checks. ${testDir}`);
} catch (error) {
  console.error(error);if(app){try{const p=await app.firstWindow();console.error((await p.locator('body').innerText()).slice(0,8000));await p.screenshot({path:path.join(root,'failure.png')});}catch{}}
  process.exitCode=1;
} finally {if(app)try{await close();}catch{}}
