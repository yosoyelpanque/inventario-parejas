(function (root) {
  'use strict';
  const MAX_EDGE = 1600;
  const images = new WeakMap();

  async function decode(blob) {
    let bitmapError;
    if (typeof root.createImageBitmap === 'function') {
      try {
        const image = await root.createImageBitmap(blob);
        return { image, width: image.width, height: image.height, release: () => image.close() };
      } catch (error) { bitmapError = error; }
    }
    if (!root.Image || !root.URL?.createObjectURL) {
      throw bitmapError || new Error('No se pudo abrir la fotografía.');
    }
    const url = root.URL.createObjectURL(blob);
    const image = new root.Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('No se pudo abrir la fotografía.'));
        image.src = url;
      });
      return {
        image, width: image.naturalWidth, height: image.naturalHeight,
        release() { image.src = ''; root.URL.revokeObjectURL(url); }
      };
    } catch (error) {
      root.URL.revokeObjectURL(url);
      throw error;
    }
  }

  function textLines(context, text, width) {
    const lines = [];
    let line = '';
    for (const character of text) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += character;
    }
    if (line) lines.push(line.trim());
    return lines;
  }

  // Always derive from the stored original: a changed additional-item key must
  // replace the visible label without stacking watermarks or recompressing it.
  async function stamp(blob, key) {
    const label = String(key ?? '').trim().replace(/\s+/g, ' ');
    if (!label) return blob;
    if (!blob || typeof blob.arrayBuffer !== 'function') throw new Error('La fotografía no es válida.');
    const decoded = await decode(blob);
    let canvas;
    try {
      if (!(decoded.width > 0 && decoded.height > 0)) throw new Error('La fotografía no tiene dimensiones válidas.');
      const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
      canvas = root.document.createElement('canvas');
      const width = canvas.width = Math.max(1, Math.round(decoded.width * scale));
      const height = canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar la fotografía con clave.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.image, 0, 0, width, height);
      const fontSize = Math.max(1, Math.round(width * 0.04));
      const padding = Math.max(1, Math.round(width * 0.025));
      const lineHeight = Math.max(1, Math.round(fontSize * 1.25));
      context.font = `600 ${fontSize}px Arial, sans-serif`;
      const lines = textLines(context, `Clave única: ${label}`, Math.max(1, width - padding * 2));
      const bandHeight = Math.min(height, lines.length * lineHeight + padding * 2);
      context.fillStyle = 'rgba(0, 0, 0, 0.64)';
      context.fillRect(0, height - bandHeight, width, bandHeight);
      context.fillStyle = '#ffffff';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      lines.forEach((line, index) => context.fillText(line, padding, height - bandHeight + padding + index * lineHeight));
      return await new Promise((resolve, reject) => {
        canvas.toBlob(result => {
          if (result?.size && result.type === 'image/jpeg') resolve(result);
          else reject(new Error('No se pudo generar la fotografía con clave.'));
        }, 'image/jpeg', 0.9);
      });
    } finally {
      decoded.release();
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
  }

  async function render(element, blob, key) {
    let slot = images.get(element);
    if (!slot) { slot = { request: 0, url: null }; images.set(element, slot); }
    const request = ++slot.request;
    const result = await stamp(blob, key);
    if (slot.request !== request) return false;
    const url = root.URL.createObjectURL(result);
    const previous = slot.url;
    try { element.src = url; } catch (error) { root.URL.revokeObjectURL(url); throw error; }
    slot.url = url;
    if (previous) root.URL.revokeObjectURL(previous);
    return true;
  }

  function clear(element) {
    const slot = images.get(element);
    if (slot) {
      slot.request++;
      if (slot.url) root.URL.revokeObjectURL(slot.url);
      slot.url = null;
    }
    element.removeAttribute('src');
  }

  root.InventoryPhotoWatermark = { stamp, render, clear };
})(typeof window !== 'undefined' ? window : globalThis);
