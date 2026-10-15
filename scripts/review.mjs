import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('.test-data/revision-empaquetado');await fs.mkdir(output,{recursive:true});
const env={...process.env,REPARTO_DATA_DIR:output};delete env.REPARTO_TEST_HIDDEN;delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:path.resolve('entrega/win-unpacked/Reparto.exe'),args:[],env,timeout:30000});
try{
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('#new-zone');
  await page.waitForFunction(()=>document.querySelectorAll('.leaflet-tile-loaded').length>0,{},{timeout:25000});
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(output,'Reparto-Parana.png')});
  const tileState=await page.evaluate(()=>({loaded:document.querySelectorAll('.leaflet-tile-loaded').length,alert:document.querySelector('#map-alert')?.hidden===false}));
  const liveSearch=await page.evaluate(()=>window.reparto.search('San Martín 1250'));
  if(!liveSearch.ok || !liveSearch.value.results.length) throw new Error(`Falló la comprobación real del buscador: ${JSON.stringify(liveSearch)}`);
  console.log(JSON.stringify({packagedApp:true,errors,tileState,liveSearch:liveSearch.value,screenshot:path.join(output,'Reparto-Parana.png')}));
}finally{await app.evaluate(({app})=>app.exit(0));}
