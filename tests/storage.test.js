import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../desktop/storage.js';
import { createDocument } from '../shared/domain.js';
const root = path.resolve('.test-data/storage');
async function make() { await fs.mkdir(root,{recursive:true});const dir=await fs.mkdtemp(path.join(root,'case-'));return new Store(dir); }
test('save/reload preserves full document on disk', async () => {const store=await make();const d=createDocument();d.settings.business='Prueba';await store.save(d);assert.deepEqual((await new Store(store.directory).load()).document,d);});
test('concurrent saves preserve submission order', async () => {const store=await make();await Promise.all(Array.from({length:8},(_,i)=>{const d=createDocument();d.settings.business=`local ${i}`;return store.save(d);}));assert.equal((await store.load()).document.settings.business,'local 7');});
test('corrupt main file recovers prior valid backup and preserves original', async () => {const store=await make();const d=createDocument();await store.save(d);d.settings.business='Segundo';await store.save(d);await fs.writeFile(store.file,'broken');const r=await store.load();assert.equal(r.recovered,true);assert.equal(r.document.settings.business,'Mi local');assert.ok((await fs.readdir(store.directory)).some(n=>n.startsWith('zonas-danadas-')));});
test('both corrupt files are never silently overwritten', async () => {const store=await make();await fs.writeFile(store.file,'broken');await assert.rejects(store.load(),/conservaron/);await assert.rejects(store.save(createDocument()),/bloqueado/);assert.equal(await fs.readFile(store.file,'utf8'),'broken');});
test('pre-import snapshot retains current data', async () => {const store=await make();const d=createDocument();await store.save(d);await store.beforeImport();const file=(await fs.readdir(store.directory)).find(n=>n.startsWith('antes-de-importar-'));assert.deepEqual(JSON.parse(await fs.readFile(path.join(store.directory,file),'utf8')),d);});
test('missing main file recovers existing backup instead of starting empty', async () => {const store=await make();const d=createDocument();d.settings.business='Rescatado';await fs.writeFile(`${store.file}.bak`,JSON.stringify(d));const loaded=await store.load();assert.equal(loaded.recovered,true);assert.equal(loaded.document.settings.business,'Rescatado');});
