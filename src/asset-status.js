(function(root) {
  function area(item, user) {
    const normalize = value => String(value ?? '').trim().replace(/^0+(?=\d)/, '');
    const original = normalize(item.areaOriginal), assigned = normalize(user?.area);
    const known = value => value && !/^(sin área|desconocida|n\/a)$/i.test(value);
    // Compare the actual assignee, never the auditor or a different active user.
    const mismatch = !!(item.UBICADO === 'SI' && known(original) && known(assigned) && original !== assigned);
    return { mismatch, message: mismatch ? `Fuera de área: bien ${original} · resguardante ${assigned}` : '' };
  }
  const api = { area }; root.InventoryAssetStatus = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
