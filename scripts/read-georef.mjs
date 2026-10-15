// Convert a Georef GeoPackage to ordinary records without a runtime dependency.
import { DatabaseSync } from 'node:sqlite';

function geometry(blob) {
  const data = Buffer.from(blob);
  const envelope = (data[3] >> 1) & 7;
  const sizes = [0, 4, 6, 6, 8];
  if (data.toString('ascii', 0, 2) !== 'GP' || sizes[envelope] === undefined) throw new Error('Invalid GeoPackage geometry');
  let offset = 8 + sizes[envelope] * 8;
  function read() {
    const little = data[offset++] === 1;
    const uint = () => { const value = little ? data.readUInt32LE(offset) : data.readUInt32BE(offset); offset += 4; return value; };
    const double = () => { const value = little ? data.readDoubleLE(offset) : data.readDoubleBE(offset); offset += 8; return value; };
    const type = uint();
    if (type === 2) return [Array.from({ length: uint() }, () => [double(), double()])];
    if (type === 5 || type === 7) return Array.from({ length: uint() }, read).flat();
    throw new Error(`Unsupported WKB type ${type}`);
  }
  return read();
}

export function readGeoref(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const metadata = db.prepare('SELECT * FROM gpkg_geometry_columns').get();
    if (metadata.table_name !== 'calles' || metadata.column_name !== 'geom' || metadata.srs_id !== 4326) throw new Error('Unexpected Georef schema');
    return db.prepare('SELECT * FROM calles').all().map(({ geom, ...record }) => ({ ...record, paths: geometry(geom) }));
  } finally { db.close(); }
}
