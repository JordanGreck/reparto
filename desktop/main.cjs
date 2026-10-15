const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

if (process.env.REPARTO_DATA_DIR) app.setPath('userData', path.resolve(process.env.REPARTO_DATA_DIR));
app.setName('Reparto');
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  let win, store, document, geocoder, draftDirty = false, saveFailed = false, closing = false;
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  const safeCall = (channel, handler) => ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame) return { ok: false, error: 'Solicitud no autorizada.' };
    try { return { ok: true, value: await handler(...args) }; }
    catch (error) { return { ok: false, error: error.message || 'Ocurrió un error inesperado.' }; }
  });
  app.whenReady().then(async () => {
    const { Store } = await import('./storage.js');
    const { Geocoder } = await import('../shared/geocoder.js');
    const { validateDocument } = await import('../shared/domain.js');
    const directory = app.getPath('userData');
    store = new Store(directory);
    let cache = {};
    try { const candidate = JSON.parse(await fs.readFile(path.join(directory, 'direcciones-cache.json'), 'utf8')); if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) cache = candidate; } catch {}
    geocoder = new Geocoder({ cache, onCache: async (data) => { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(path.join(directory, 'direcciones-cache.json'), JSON.stringify(data)); } });
    session.defaultSession.setUserAgent(`${session.defaultSession.getUserAgent()} RepartoDesktop/1.0`);
    if (process.env.REPARTO_TEST_HIDDEN) session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://tile.openstreetmap.org/*'] }, (_details, callback) => callback({ cancel: true }));
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win = new BrowserWindow({ width: 1440, height: 940, minWidth: 1050, minHeight: 740, title: 'Reparto · Zonas de delivery', icon: path.join(__dirname, '../assets/reparto.ico'), backgroundColor: '#f6f7f4', show: false, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: !process.env.REPARTO_TEST_HIDDEN } });
    win.setMenu(null);
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url === 'mailto:jordangreck@gmail.com') shell.openExternal(url).catch(() => dialog.showMessageBox(win, { type: 'info', title: 'Contacto de Reparto', message: 'Podés escribir a jordangreck@gmail.com', detail: 'No se pudo abrir tu aplicación de correo. Usá Copiar email en Ayuda y pegalo en el correo que uses habitualmente.' }));
      if (/^https:\/\/(www\.)?(openstreetmap\.org|operations\.osmfoundation\.org|nominatim\.org)\//.test(url) || /^https:\/\/www\.argentina\.gob\.ar\/georef(?:\/|$)/.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    const entryUrl = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
    win.webContents.on('will-navigate', (event, url) => { if (url !== entryUrl) event.preventDefault(); });
    win.on('close', async (event) => {
      if (closing) return;
      event.preventDefault();
      try { await store.queue; } catch { saveFailed = true; }
      if (draftDirty || saveFailed) {
        const { response } = await dialog.showMessageBox(win, { type: 'warning', title: 'Cambios pendientes', message: saveFailed ? 'Hay cambios que no pudieron guardarse.' : 'Hay una zona o configuración en edición.', detail: 'Si cerrás ahora, se perderán los cambios pendientes.', buttons: ['Seguir trabajando', 'Cerrar de todos modos'], defaultId: 0, cancelId: 0 });
        if (response !== 1) return;
      }
      closing = true; win.close();
    });
    safeCall('reparto:load', async () => { const result = await store.load(); document = result.document; return result; });
    safeCall('reparto:save', async (input) => {
      const valid = validateDocument(input);
      try { await store.save(valid); document = valid; saveFailed = false; return { saved: true }; }
      catch (e) { saveFailed = true; throw e; }
    });
    safeCall('reparto:search', (query) => { if (!document) throw new Error('Esperá a que se carguen las zonas.'); return geocoder.search(query, document.settings); });
    safeCall('reparto:backup', async () => {
      await store.queue;
      const { canceled, filePath } = await dialog.showSaveDialog(win, { title: 'Guardar copia de seguridad', defaultPath: `Reparto-respaldo-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Respaldo de Reparto', extensions: ['json'] }] });
      if (canceled) return null;
      await fs.writeFile(filePath, JSON.stringify(validateDocument(document), null, 2), 'utf8'); return { path: filePath };
    });
    safeCall('reparto:import', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Restaurar copia de seguridad', properties: ['openFile'], filters: [{ name: 'Respaldo de Reparto', extensions: ['json'] }] });
      if (canceled) return null;
      if ((await fs.stat(filePaths[0])).size > 5 * 1024 * 1024) throw new Error('El respaldo supera el máximo de 5 MB.');
      let parsed; try { parsed = JSON.parse(await fs.readFile(filePaths[0], 'utf8')); } catch { throw new Error('El archivo no contiene un respaldo JSON válido.'); }
      const imported = validateDocument(parsed);
      const { response } = await dialog.showMessageBox(win, { type: 'warning', title: 'Restaurar respaldo', message: `¿Reemplazar los datos por ${imported.zones.length} zonas de ${imported.settings.city}?`, detail: 'Se guardará una copia de los datos actuales antes de reemplazarlos.', buttons: ['Cancelar', 'Restaurar respaldo'], defaultId: 0, cancelId: 0 });
      if (response !== 1) return null;
      await store.beforeImport(); await store.save(imported); document = imported; return imported;
    });
    safeCall('reparto:image', async (rect) => {
      const bounds = win.getContentBounds();
      if (!rect || !['x', 'y', 'width', 'height'].every((k) => Number.isInteger(rect[k])) || rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 || rect.x + rect.width > bounds.width || rect.y + rect.height > bounds.height) throw new Error('No se pudo capturar el área del mapa.');
      const image = await win.webContents.capturePage(rect);
      const { canceled, filePath } = await dialog.showSaveDialog(win, { title: 'Exportar mapa con zonas', defaultPath: 'Reparto-mapa.png', filters: [{ name: 'Imagen PNG', extensions: ['png'] }] });
      if (canceled) return null;
      await fs.writeFile(filePath, image.toPNG()); return { path: filePath };
    });
    safeCall('reparto:data', async () => { const result = await shell.openPath(directory); if (result) throw new Error(result); return true; });
    ipcMain.on('reparto:dirty', (event, dirty) => { if (event.sender === win.webContents) draftDirty = Boolean(dirty); });
    ipcMain.on('reparto:ready', (event) => { if (event.sender === win.webContents && !process.env.REPARTO_TEST_HIDDEN) win.show(); });
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
    if (!process.env.REPARTO_TEST_HIDDEN) win.show();
  }).catch((e) => { dialog.showErrorBox('No se pudo iniciar Reparto', e.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
