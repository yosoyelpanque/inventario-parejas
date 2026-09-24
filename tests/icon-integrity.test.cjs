const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function verifyPng(file, size) {
  const data = fs.readFileSync(file);
  assert.deepEqual(data.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), `${file}: firma PNG`);
  let offset = 8;
  let header;
  let ended = false;
  const imageData = [];
  while (offset < data.length) {
    assert.ok(offset + 12 <= data.length, `${file}: cabecera de bloque completa`);
    const length = data.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= data.length, `${file}: bloque completo`);
    const type = data.toString('ascii', offset + 4, offset + 8);
    assert.equal(crc32(data.subarray(offset + 4, end - 4)), data.readUInt32BE(end - 4), `${file}: CRC ${type}`);
    const body = data.subarray(offset + 8, end - 4);
    if (offset === 8) assert.equal(type, 'IHDR', `${file}: cabecera inicial`);
    if (type === 'IHDR') {
      assert.equal(header, undefined, `${file}: cabecera única`);
      assert.equal(length, 13, `${file}: tamaño de cabecera`);
      header = body;
    }
    if (type === 'IDAT') imageData.push(body);
    offset = end;
    if (type === 'IEND') {
      assert.equal(length, 0, `${file}: terminador`);
      ended = true;
      break;
    }
  }
  assert.ok(ended, `${file}: bloque IEND presente`);
  assert.equal(offset, data.length, `${file}: sin datos sobrantes`);
  assert.equal(header.readUInt32BE(0), size, `${file}: ancho`);
  assert.equal(header.readUInt32BE(4), size, `${file}: alto`);
  assert.equal(header[8], 8, `${file}: profundidad de 8 bits`);
  assert.ok([2, 6].includes(header[9]), `${file}: RGB o RGBA`);
  assert.deepEqual([...header.subarray(10)], [0, 0, 0], `${file}: PNG sin entrelazar`);
  const decoded = zlib.inflateSync(Buffer.concat(imageData));
  const stride = size * (header[9] === 6 ? 4 : 3) + 1;
  assert.equal(decoded.length, stride * size, `${file}: píxeles completos`);
  for (let row = 0; row < size; row++) {
    assert.ok(decoded[row * stride] <= 4, `${file}: filtro de fila válido`);
  }
}

test('todos los iconos Android son PNG completos y tienen las dimensiones de su densidad', () => {
  const root = path.join(__dirname, '../native/android/icons');
  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
      verifyPng(path.join(root, `mipmap-${density}`, `${name}.png`), (name.endsWith('foreground') ? 108 : 48) * scale);
    }
  }
});
