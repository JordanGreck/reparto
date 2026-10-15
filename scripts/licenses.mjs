import fs from 'node:fs/promises';
import path from 'node:path';
const packages = new Map();
const dirs = await fs.readdir('node_modules', { withFileTypes: true });
async function collect(name) {
  try {
    const dir=path.join('node_modules',name);const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));
    packages.set(name,{pkg,dir});
  } catch {}
}
for(const entry of dirs){if(entry.name.startsWith('@')){for(const sub of await fs.readdir(path.join('node_modules',entry.name)))await collect(`${entry.name}/${sub}`);}else if(entry.isDirectory())await collect(entry.name);}
const wanted=new Set();
function include(name){if(wanted.has(name))return;wanted.add(name);const p=packages.get(name);if(p)for(const dep of Object.keys(p.pkg.dependencies||{}))include(dep);}
const root=JSON.parse(await fs.readFile('package.json','utf8'));Object.keys(root.dependencies).forEach(include);
let content='REPARTO — Avisos de software de terceros\n\nDatos cartográficos © OpenStreetMap contributors, ODbL 1.0.\nhttps://www.openstreetmap.org/copyright\n\nElectron y Chromium incluyen sus licencias en los archivos de la distribución.\n';
for(const name of [...wanted].sort()){
  const item=packages.get(name);if(!item)continue;
  content+=`\n${'='.repeat(72)}\n${name} ${item.pkg.version}\nLicencia: ${item.pkg.license || 'Consultar distribución'}\n`;
  const files=await fs.readdir(item.dir);const license=files.find(n=>/^license(\.|$)/i.test(n))||files.find(n=>/^licence(\.|$)/i.test(n));
  if(license)content+=await fs.readFile(path.join(item.dir,license),'utf8');
  content+='\n';
}
content += '\nCATÁLOGO LOCAL DE CALLES DE PARANÁ\nassets/parana-streets.json: base de datos derivada de OpenStreetMap, bajo ODbL 1.0.\n© OpenStreetMap contributors. Extracto regional de Geofabrik.\nhttps://www.openstreetmap.org/copyright\nhttps://opendatacommons.org/licenses/odbl/1-0/\nLa base derivada se distribuye íntegra con esta aplicación y su código fuente.\nVer assets/CATALOGO-CALLES.md y los campos de fecha y fuente del archivo JSON.\n';
content += '\nCALLES COMPLEMENTARIAS DE PARANÁ\nassets/parana-supplemental-streets.json: Servicio Georef – argentina.gob.ar/georef. Fuente: INDEC.\nLicencia Creative Commons Atribución 4.0 Internacional (CC BY 4.0).\nhttps://www.argentina.gob.ar/georef/condiciones-de-uso-y-licencia\nhttps://creativecommons.org/licenses/by/4.0/\nDatos modificados: selección de vías, conversión de formato y mayúsculas, derivación de cruces por vértices compartidos.\nVer assets/CALLES-COMPLEMENTARIAS.md para procedencia, alcance y reconstrucción.\n';
await fs.writeFile('THIRD-PARTY-NOTICES.txt',content);
