import fs from 'node:fs/promises';
import path from 'node:path';
import { createDocument, validateDocument } from '../shared/domain.js';

export class Store {
  constructor(directory) { this.directory = directory; this.file = path.join(directory, 'zonas.json'); this.queue = Promise.resolve(); this.readOnly = false; }
  async load() {
    await fs.mkdir(this.directory, { recursive: true });
    try { return { document: validateDocument(JSON.parse(await fs.readFile(this.file, 'utf8'))), recovered: false }; }
    catch (error) {
      const missingMain = error.code === 'ENOENT';
      if (missingMain) {
        try { await fs.access(`${this.file}.bak`); } catch (e) { if (e.code === 'ENOENT') return { document: createDocument(), recovered: false }; throw e; }
      }
      try {
        const document = validateDocument(JSON.parse(await fs.readFile(`${this.file}.bak`, 'utf8')));
        if (!missingMain) await fs.copyFile(this.file, path.join(this.directory, `zonas-danadas-${Date.now()}.json`));
        await fs.copyFile(`${this.file}.bak`, this.file);
        return { document, recovered: true };
      } catch {
        this.readOnly = true;
        throw new Error('No se pudo leer el archivo de zonas ni su respaldo. Los archivos originales se conservaron. Revisá la carpeta de datos antes de continuar.');
      }
    }
  }
  save(input) {
    if (this.readOnly) return Promise.reject(new Error('El guardado está bloqueado para proteger el archivo dañado.'));
    const document = validateDocument(input);
    const operation = this.queue.catch(() => {}).then(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      const serialized = JSON.stringify(document, null, 2);
      const temp = `${this.file}.tmp`;
      const handle = await fs.open(temp, 'w');
      try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      try { await fs.copyFile(this.file, `${this.file}.bak`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      await fs.rename(temp, this.file);
      return { saved: true };
    });
    this.queue = operation;
    return operation;
  }
  async beforeImport() {
    await this.queue;
    try { await fs.copyFile(this.file, path.join(this.directory, `antes-de-importar-${Date.now()}.json`)); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
