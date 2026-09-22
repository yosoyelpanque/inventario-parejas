/* Shared output boundary: browser downloads or Android's document picker. */
(function () {
  const native = !!window.Capacitor?.isNativePlatform();
  const plugin = native ? window.Capacitor.registerPlugin('InventoryFiles') : null;
  let exporting = false;
  async function save(blob, name) {
    if (!native) {
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
    if (exporting) throw Error('Termina de guardar el archivo anterior.');
    exporting = true;
    let id;
    try {
      ({ id } = await plugin.beginExport());
      // Bound each bridge message; backups can contain many photographs.
      for (let offset = 0; offset < blob.size; offset += 262144) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + 262144).arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        await plugin.appendExport({ id, data: btoa(binary) });
      }
      await plugin.finishExport({ id, name, mime: blob.type || 'application/octet-stream' });
    } finally {
      if (id) await plugin.cancelExport({ id }).catch(() => {});
      exporting = false;
    }
  }
  async function excel(book, name) {
    return save(new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' })],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  }
  async function print() { if (native) await plugin.print(); else window.print(); }
  window.InventoryOutput = { native, save, excel, print };
})();
