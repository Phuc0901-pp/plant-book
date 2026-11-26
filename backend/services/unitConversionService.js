function convertAmountToBaseUnit(amount, inputUnit, baseUnit, logType = '') {
  const qty = parseFloat(amount);
  if (!Number.isFinite(qty) || qty <= 0) return 0;

  const from = String(inputUnit || '').toLowerCase().trim();
  const to = String(baseUnit || 'kg').toLowerCase().trim();
  const lt = String(logType || '').toLowerCase().trim();

  if (lt === 'tưới nước' || from === 'lít' || from === 'l' || from === 'lit') {
    if (to === 'm3' || to === 'm³' || to === 'khối') {
      if (from === 'm3' || from === 'm³' || from === 'khối') return qty;
      return qty / 1000;
    }
    if (to === 'ml') return qty * 1000;
    return qty;
  }

  if (from === to || !from) return qty;

  if ((from === 'g' || from === 'gam' || from === 'gr' || from === 'gram') && to === 'kg') {
    return qty / 1000;
  }
  if (from === 'kg' && (to === 'g' || to === 'gam' || to === 'gr' || to === 'gram')) {
    return qty * 1000;
  }
  if ((from === 'tấn' || from === 'tan' || from === 'ton') && to === 'kg') {
    return qty * 1000;
  }
  if (from === 'kg' && (to === 'tấn' || to === 'tan' || to === 'ton')) {
    return qty / 1000;
  }
  if (from === 'ml' && (to === 'l' || to === 'lít' || to === 'lit')) {
    return qty / 1000;
  }
  if ((from === 'l' || from === 'lít' || from === 'lit') && to === 'ml') {
    return qty * 1000;
  }
  if (from === 'ml' && (to === 'm3' || to === 'm³' || to === 'khối')) {
    return qty / 1000000;
  }

  return qty;
}

function normalizeAreaToSquareMeters(areaValue, unit = 'm2') {
  const num = parseFloat(areaValue);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const u = String(unit || 'm2').toLowerCase().trim();
  if (u === 'ha' || u === 'hecta' || u === 'hectare') return num * 10000;
  if (u === 'sào' || u === 'sao') return num * 1000;
  if (u === 'công' || u === 'cong') return num * 1000;
  return num;
}

module.exports = {
  convertAmountToBaseUnit,
  normalizeAreaToSquareMeters
};
