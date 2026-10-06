const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../src/photo-watermark.js'), 'utf8');

function fixture(options = {}) {
  const calls = { draw: [], text: [], fills: [], encoded: [], closed: 0, revoked: [], created: [], canvases: [] };
  const bitmap = () => ({ width: options.width || 2400, height: options.height || 1800, close() { calls.closed++; } });
  const context = {
    drawImage(...args) { calls.draw.push(args); },
    fillRect(...args) { calls.fills.push([this.fillStyle, ...args]); },
    fillText(...args) { calls.text.push(args); },
    measureText(text) { return { width: text.length * (parseFloat(this.font.match(/[\d.]+px/)[0]) * 0.6) }; }
  };
  const sandbox = {
    createImageBitmap: options.decode || (async () => bitmap()),
    URL: {
      createObjectURL(blob) { const url = `blob:test-${calls.created.length}`; calls.created.push({ blob, url }); return url; },
      revokeObjectURL(url) { calls.revoked.push(url); }
    },
    document: {
      createElement() {
        const canvas = {
          getContext() { return options.noContext ? null : context; },
          toBlob(done, type, quality) {
            calls.encoded.push({ width: this.width, height: this.height, type, quality });
            done(options.encodeFailure ? null : new Blob(['jpeg-result'], { type }));
          }
        };
        calls.canvases.push(canvas);
        return canvas;
      }
    }
  };
  vm.runInNewContext(source, sandbox);
  return { api: sandbox.InventoryPhotoWatermark, calls, bitmap };
}

test('sin clave conserva original exacto y no necesita cámara, canvas ni decodificación', async () => {
  const { api, calls } = fixture({ decode: () => { throw Error('No debe decodificar'); } });
  const original = new Blob(['original']);
  assert.equal(await api.stamp(original, '  '), original);
  assert.equal(await api.stamp(original, null), original);
  assert.equal(calls.canvases.length, 0);
});

test('produce copia JPEG con clave completa, conserva proporción y no modifica el original', async () => {
  const { api, calls } = fixture();
  const original = new Blob(['bytes originales'], { type: 'image/png' });
  const marked = await api.stamp(original, '  0.228753  ');
  assert.notEqual(marked, original);
  assert.equal(marked.type, 'image/jpeg');
  assert.equal(await original.text(), 'bytes originales');
  assert.deepEqual(calls.encoded[0], { width: 1600, height: 1200, type: 'image/jpeg', quality: 0.9 });
  assert.equal(calls.text.map(line => line[0]).join(''), 'Clave única: 0.228753');
  assert.equal(calls.draw[0][3], 1600);
  assert.equal(calls.draw[0][4], 1200);
  assert.equal(calls.closed, 1);
  assert.equal(calls.canvases[0].width, 0);
});

test('no agranda fotografías pequeñas y envuelve claves largas dentro del ancho', async () => {
  const { api, calls } = fixture({ width: 300, height: 500 });
  const key = 'ABC0123456789'.repeat(6);
  await api.stamp(new Blob(['small']), key);
  assert.equal(calls.encoded[0].width, 300);
  assert.equal(calls.encoded[0].height, 500);
  assert.ok(calls.text.length > 1);
  assert.equal(calls.text.map(line => line[0]).join(''), 'Clave única: ' + key);
});

test('errores al procesar se propagan sin mutar original y liberan recursos', async () => {
  const original = new Blob(['conservar']);
  for (const options of [{ noContext: true }, { encodeFailure: true }]) {
    const { api, calls } = fixture(options);
    await assert.rejects(api.stamp(original, '123'), /fotografía con clave/);
    assert.equal(calls.closed, 1);
    assert.equal(calls.canvases[0].width, 0);
  }
  const { api } = fixture({ decode: async () => { throw Error('imagen dañada'); } });
  await assert.rejects(api.stamp(original, '123'), /imagen dañada/);
  assert.equal(await original.text(), 'conservar');
});

test('render evita carreras, revoca URLs reemplazadas y clear cancela renders pendientes', async () => {
  const pending = [];
  const { api, calls, bitmap } = fixture({ decode: () => new Promise(resolve => pending.push(resolve)) });
  const element = { src: '', removeAttribute() { this.src = ''; } };
  const original = new Blob(['source']);
  const first = api.render(element, original, 'A');
  const second = api.render(element, original, 'B');
  pending[1](bitmap());
  assert.equal(await second, true);
  const latestUrl = element.src;
  pending[0](bitmap());
  assert.equal(await first, false);
  assert.equal(element.src, latestUrl);
  assert.equal(calls.created.length, 1);
  await api.render(element, original, '');
  assert.ok(calls.revoked.includes(latestUrl));
  const third = api.render(element, original, 'C');
  api.clear(element);
  pending[2](bitmap());
  assert.equal(await third, false);
  assert.equal(element.src, '');
  assert.equal(calls.revoked.length, 2);
});
