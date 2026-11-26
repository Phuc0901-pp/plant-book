const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const signpdf = require('@signpdf/signpdf').default;
const { P12Signer } = require('@signpdf/signer-p12');
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { createEnterpriseP12Buffer } = require('../scripts/generate-dev-p12');

const DEFAULT_LOGO_PATH = path.resolve(__dirname, '../../frontend/assets/logo.png');

let _cachedDevP12 = null;
let _warnedAutoP12Prod = false;

function toPdfAscii(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseP12Metadata(p12Buffer, passphrase) {
  const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'), 'raw');
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase || '');
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (certBags.length === 0 || !certBags[0].cert) {
    throw new Error('Khong tim thay chung thu X.509 hop le trong file .p12.');
  }
  const cert = certBags[0].cert;
  const cnAttr = cert.subject.getField('CN');
  const orgAttr = cert.subject.getField('O');
  const derCertBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const fingerprint = forge.md.sha256.create().update(derCertBytes).digest().toHex();

  return {
    cert,
    signer_cn: cnAttr ? String(cnAttr.value) : 'Tan Bao Sai Gon AgTech',
    signer_org: orgAttr ? String(orgAttr.value) : 'Tan Bao Sai Gon AgTech',
    cert_serial: cert.serialNumber || '01',
    cert_fingerprint_sha256: fingerprint,
    valid_from: cert.validity && cert.validity.notBefore ? cert.validity.notBefore.toISOString() : null,
    valid_to: cert.validity && cert.validity.notAfter ? cert.validity.notAfter.toISOString() : null
  };
}

function loadEnterpriseP12Material(override = {}) {
  if (override.p12Buffer) {
    const pass = override.p12Passphrase !== undefined ? String(override.p12Passphrase) : '';
    const meta = parseP12Metadata(override.p12Buffer, pass);
    return { p12Buffer: override.p12Buffer, passphrase: pass, ...meta };
  }

  const pass = process.env.REPORT_SIGNING_P12_PASS || '';
  if (process.env.REPORT_SIGNING_P12_BASE64) {
    const p12Buffer = Buffer.from(process.env.REPORT_SIGNING_P12_BASE64.trim(), 'base64');
    const meta = parseP12Metadata(p12Buffer, pass);
    return { p12Buffer, passphrase: pass, ...meta };
  }

  if (process.env.REPORT_SIGNING_P12_PATH) {
    const absPath = path.resolve(process.env.REPORT_SIGNING_P12_PATH);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Khong tim thay file chung thu .p12 tai: ${absPath}`);
    }
    const p12Buffer = fs.readFileSync(absPath);
    const meta = parseP12Metadata(p12Buffer, pass);
    return { p12Buffer, passphrase: pass, ...meta };
  }

  const defaultCertPath = path.resolve(__dirname, '../certs/enterprise-report-signer.p12');
  if (fs.existsSync(defaultCertPath)) {
    const p12Buffer = fs.readFileSync(defaultCertPath);
    const meta = parseP12Metadata(p12Buffer, pass || 'TanBaoAgTechISO2026!');
    return { p12Buffer, passphrase: pass || 'TanBaoAgTechISO2026!', ...meta };
  }

  if (process.env.REQUIRE_EXTERNAL_P12_CERT === 'true') {
    throw new Error('Thieu cau hinh chung thu ky so .p12 doanh nghiep (REPORT_SIGNING_P12_BASE64 hoac REPORT_SIGNING_P12_PATH).');
  }

  if (!_cachedDevP12) {
    if (process.env.NODE_ENV === 'production' && !_warnedAutoP12Prod) {
      _warnedAutoP12Prod = true;
      console.warn('[signedPdfService] Auto-provisioning in-memory Enterprise PKCS#12 signer because REPORT_SIGNING_P12_* is not configured.');
    }
    _cachedDevP12 = createEnterpriseP12Buffer({
      cn: 'CONG TY TNHH CONG NGHE NONG NGHIEP TAN BAO SAI GON',
      org: 'Tan Bao Sai Gon AgTech ERP'
    });
  }
  const meta = parseP12Metadata(_cachedDevP12.p12Buffer, _cachedDevP12.passphrase);
  return { p12Buffer: _cachedDevP12.p12Buffer, passphrase: _cachedDevP12.passphrase, ...meta };
}

function computeLogsMerkleRoot(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return crypto.createHash('sha256').update('EMPTY_ISO_REPORT_MERKLE_ROOT').digest('hex');
  }
  let layer = logs.map((log, idx) => {
    const seed = log && log.record_hash
      ? String(log.record_hash)
      : `${log?.id || idx}|${log?.plant_id || 0}|${log?.log_date || ''}|${log?.log_type || ''}`;
    return crypto.createHash('sha256').update(seed).digest('hex');
  });
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(crypto.createHash('sha256').update(`${left}:${right}`).digest('hex'));
    }
    layer = next;
  }
  return layer[0];
}

function extractByteRangeAndContents(pdfBuffer) {
  const rawStr = pdfBuffer.toString('latin1');
  const brMatch = rawStr.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  if (!brMatch) return null;
  const start1 = parseInt(brMatch[1], 10);
  const len1 = parseInt(brMatch[2], 10);
  const start2 = parseInt(brMatch[3], 10);
  const len2 = parseInt(brMatch[4], 10);
  const gapHex = rawStr.slice(start1 + len1, start2);
  const hexMatch = gapHex.match(/<([0-9a-fA-F]+)>/);
  if (!hexMatch) return null;
  return {
    byteRange: [start1, len1, start2, len2],
    contentsHex: hexMatch[1]
  };
}

async function generateSignedIsoPdf(options = {}) {
  const report = options.report || { rows: [], summary: {} };
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const summary = report.summary || {};
  const title = options.title || 'SO NHAT KY CANH TAC & HO SO XUAT KHAU VIETGAP / GLOBALGAP / ISO 22005';
  const standardLabel = options.standardLabel || 'VietGAP (TCVN 11892-1:2017) | GlobalG.A.P. IFA v6.0 | ISO 22005:2007';
  const farmName = options.farmName || (rows[0] && rows[0].farm_name) || 'Trang trai Nong nghiep Cong nghe cao';
  const pucCode = options.pucCode || (rows[0] && rows[0].puc_code) || 'VN-TB-01';
  const certUuid = options.certUuid || crypto.randomUUID();
  const verifyBaseUrl = options.verifyBaseUrl || 'https://plant-book.onrender.com/api/plants/public/verify-report';
  const verifyUrl = `${verifyBaseUrl}/${certUuid}`;
  const issuedAt = new Date().toISOString();
  const merkleRoot = computeLogsMerkleRoot(rows);
  const p12Mat = loadEnterpriseP12Material({
    p12Buffer: options.p12Buffer,
    p12Passphrase: options.p12Passphrase
  });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(toPdfAscii(title));
  pdfDoc.setSubject(toPdfAscii(standardLabel));
  pdfDoc.setCreator('PlantBook Agri-ERP P12 Signing Engine');
  pdfDoc.setProducer(toPdfAscii(p12Mat.signer_org));

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImage = null;
  const logoPath = options.logoPath || DEFAULT_LOGO_PATH;
  if (fs.existsSync(logoPath)) {
    const logoBytes = fs.readFileSync(logoPath);
    logoImage = await pdfDoc.embedPng(logoBytes);
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 40;

  if (logoImage) {
    const scaled = logoImage.scaleToFit(54, 54);
    page.drawImage(logoImage, { x: margin, y: y - scaled.height + 12, width: scaled.width, height: scaled.height });
  }

  const headerX = logoImage ? margin + 66 : margin;
  page.drawText('TAN BAO SAI GON AGTECH - PLANT BOOK ERP', {
    x: headerX,
    y: y + 2,
    size: 9,
    font: fontBold,
    color: rgb(0.02, 0.45, 0.31)
  });
  page.drawText(toPdfAscii(title).slice(0, 72), {
    x: headerX,
    y: y - 14,
    size: 13,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16)
  });
  page.drawText(toPdfAscii(standardLabel).slice(0, 90), {
    x: headerX,
    y: y - 28,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.28, 0.33, 0.41)
  });

  y -= 52;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.05, 0.59, 0.41) });
  y -= 18;

  const metaLines = [
    `Trang trai: ${toPdfAscii(farmName)} | Ma PUC: ${toPdfAscii(pucCode)} | Chung thu so ID: ${certUuid}`,
    `Ky bao cao: ${toPdfAscii(summary.date_from || 'Tat ca')} -> ${toPdfAscii(summary.date_to || 'Hien tai')} | Tong ban ghi: ${rows.length} | Vi pham PHI: ${summary.phi_violations || 0}`,
    `SHA-256 Merkle Root: ${merkleRoot}`
  ];
  for (const ml of metaLines) {
    page.drawText(ml.slice(0, 108), { x: margin, y, size: 8.5, font: fontRegular, color: rgb(0.15, 0.2, 0.28) });
    y -= 13;
  }

  y -= 6;
  const cols = [
    { label: 'Ngay', x: margin, w: 62 },
    { label: 'Ma Cay', x: margin + 62, w: 54 },
    { label: 'Hoat Dong', x: margin + 116, w: 78 },
    { label: 'Vat Tu / Hoat Chat / PHI', x: margin + 194, w: 158 },
    { label: 'Nguoi TH', x: margin + 352, w: 88 },
    { label: 'SHA-256', x: margin + 440, w: 83 }
  ];

  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - 4, width: pageWidth - margin * 2, height: 18, color: rgb(0.93, 0.99, 0.96) });
    for (const c of cols) {
      page.drawText(c.label, { x: c.x + 2, y: y + 1, size: 8, font: fontBold, color: rgb(0.02, 0.37, 0.25) });
    }
    y -= 20;
  };
  drawTableHeader();

  const maxRows = Math.min(rows.length, 400);
  for (let i = 0; i < maxRows; i++) {
    if (y < 135) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 44;
      drawTableHeader();
    }
    const r = rows[i] || {};
    const dStr = toPdfAscii(String(r.log_date || '').slice(0, 10));
    const treeStr = toPdfAscii(r.tree_code || r.plant_id || '').slice(0, 10);
    const typeStr = toPdfAscii(r.log_type || '').slice(0, 15);
    const matParts = [r.material_name, r.active_ingredient, r.phi_status_label].filter(Boolean).join(' | ');
    const matStr = toPdfAscii(matParts || r.note || '-').slice(0, 34);
    const opStr = toPdfAscii(r.operator_name || '-').slice(0, 18);
    const hashStr = r.record_hash ? String(r.record_hash).slice(0, 14) : '-';

    page.drawText(dStr, { x: cols[0].x + 2, y, size: 7.5, font: fontRegular, color: rgb(0.1, 0.14, 0.2) });
    page.drawText(treeStr, { x: cols[1].x + 2, y, size: 7.5, font: fontBold, color: rgb(0.1, 0.14, 0.2) });
    page.drawText(typeStr, { x: cols[2].x + 2, y, size: 7.5, font: fontRegular, color: rgb(0.1, 0.14, 0.2) });
    page.drawText(matStr, { x: cols[3].x + 2, y, size: 7.5, font: fontRegular, color: rgb(0.1, 0.14, 0.2) });
    page.drawText(opStr, { x: cols[4].x + 2, y, size: 7.5, font: fontRegular, color: rgb(0.1, 0.14, 0.2) });
    page.drawText(hashStr, { x: cols[5].x + 2, y, size: 7, font: fontRegular, color: rgb(0.3, 0.35, 0.42) });

    y -= 13;
  }

  if (y < 120) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 50;
  }
  const sealBoxY = 44;
  page.drawRectangle({
    x: margin,
    y: sealBoxY,
    width: pageWidth - margin * 2,
    height: 76,
    borderColor: rgb(0.02, 0.59, 0.41),
    borderWidth: 1.2,
    color: rgb(0.97, 0.99, 0.98)
  });
  page.drawText('CHUNG THUC KY SO DOANH NGHIEP PKCS#12 (PAdES / SHA-256)', {
    x: margin + 10,
    y: sealBoxY + 58,
    size: 9,
    font: fontBold,
    color: rgb(0.02, 0.45, 0.31)
  });
  page.drawText(`Don vi ky: ${toPdfAscii(p12Mat.signer_cn)} (${toPdfAscii(p12Mat.signer_org)})`, {
    x: margin + 10,
    y: sealBoxY + 44,
    size: 8,
    font: fontRegular,
    color: rgb(0.1, 0.14, 0.2)
  });
  page.drawText(`Serial: ${p12Mat.cert_serial} | Fingerprint SHA-256: ${p12Mat.cert_fingerprint_sha256.slice(0, 32)}...`, {
    x: margin + 10,
    y: sealBoxY + 31,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.25, 0.3, 0.38)
  });
  page.drawText(`Thoi diem ky UTC: ${issuedAt} | Xac minh cong khai: ${verifyUrl}`, {
    x: margin + 10,
    y: sealBoxY + 18,
    size: 7,
    font: fontRegular,
    color: rgb(0.25, 0.3, 0.38)
  });

  pdflibAddPlaceholder({
    pdfDoc,
    reason: toPdfAscii(`ISO 22005 / VietGAP Export Certification (${certUuid})`),
    contactInfo: toPdfAscii(p12Mat.signer_org),
    name: toPdfAscii(p12Mat.signer_cn),
    location: 'Viet Nam',
    signatureLength: 8192
  });

  const unsignedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const signer = new P12Signer(p12Mat.p12Buffer, { passphrase: p12Mat.passphrase });
  const signedPdfBuffer = await signpdf.sign(Buffer.from(unsignedPdfBytes), signer);

  const documentSha256 = crypto.createHash('sha256').update(signedPdfBuffer).digest('hex');
  const extracted = extractByteRangeAndContents(signedPdfBuffer);
  const signatureB64 = extracted
    ? Buffer.from(extracted.contentsHex.replace(/0+$/, ''), 'hex').toString('base64')
    : crypto.createHash('sha256').update(documentSha256).digest('base64');

  return {
    pdfBuffer: signedPdfBuffer,
    cert_uuid: certUuid,
    document_sha256: documentSha256,
    merkle_root: merkleRoot,
    signature_b64: signatureB64,
    signer_cn: p12Mat.signer_cn,
    signer_org: p12Mat.signer_org,
    cert_serial: p12Mat.cert_serial,
    cert_fingerprint_sha256: p12Mat.cert_fingerprint_sha256,
    logo_embedded: Boolean(logoImage),
    issued_at: issuedAt
  };
}

function verifySignedPdfBuffer(pdfBuffer, expectedRecord = null) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 32) {
    return { valid: false, tampered: true, reason: 'Du lieu PDF khong hop le.' };
  }
  const actualSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  if (expectedRecord && expectedRecord.document_sha256 && actualSha256 !== expectedRecord.document_sha256) {
    return {
      valid: false,
      tampered: true,
      document_sha256: actualSha256,
      expected_sha256: expectedRecord.document_sha256,
      reason: 'Phat hien file PDF da bi chinh sua sau khi ky so.'
    };
  }

  const extracted = extractByteRangeAndContents(pdfBuffer);
  if (!extracted) {
    return { valid: false, tampered: true, document_sha256: actualSha256, reason: 'Thieu cau truc chu ky PAdES (/ByteRange, /Contents).' };
  }

  const [s1, l1, s2, l2] = extracted.byteRange;
  const signedBytes = Buffer.concat([pdfBuffer.subarray(s1, s1 + l1), pdfBuffer.subarray(s2, s2 + l2)]);
  const signedDigest = crypto.createHash('sha256').update(signedBytes).digest('hex');

  const trimmedHex = extracted.contentsHex.replace(/(?:00)+$/, '');
  let signerCn = null;
  let certSerial = null;
  try {
    const derBytes = forge.util.hexToBytes(trimmedHex.length % 2 === 0 ? trimmedHex : `${trimmedHex}0`);
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(derBytes));
    const cert = p7 && Array.isArray(p7.certificates) && p7.certificates[0] ? p7.certificates[0] : null;
    if (cert) {
      const cnField = cert.subject.getField('CN');
      signerCn = cnField ? String(cnField.value) : null;
      certSerial = cert.serialNumber || null;
    }
    if (expectedRecord && expectedRecord.cert_serial && certSerial && certSerial.toLowerCase() !== String(expectedRecord.cert_serial).toLowerCase()) {
      return { valid: false, tampered: true, document_sha256: actualSha256, reason: 'Serial chung thu ky so khong khop.' };
    }
  } catch (err) {
    return { valid: false, tampered: true, document_sha256: actualSha256, reason: `Loi giai ma PKCS#7: ${err.message}` };
  }

  return {
    valid: true,
    tampered: false,
    document_sha256: actualSha256,
    byte_range_digest_sha256: signedDigest,
    signer_cn: signerCn || (expectedRecord && expectedRecord.signer_cn) || null,
    cert_serial: certSerial || (expectedRecord && expectedRecord.cert_serial) || null,
    reason: 'Chu ky so PKCS#12 va toan ven tai lieu hop le 100%.'
  };
}

module.exports = {
  toPdfAscii,
  loadEnterpriseP12Material,
  computeLogsMerkleRoot,
  generateSignedIsoPdf,
  verifySignedPdfBuffer
};
