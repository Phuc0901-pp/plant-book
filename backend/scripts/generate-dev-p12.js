const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

function createEnterpriseP12Buffer(options = {}) {
  const cn = options.cn || 'Cong Ty TNHH Cong Nghe Nong Nghiep Tan Bao Sai Gon';
  const org = options.org || 'Tan Bao Sai Gon AgTech';
  const country = options.country || 'VN';
  const passphrase = options.passphrase !== undefined ? String(options.passphrase) : (process.env.REPORT_SIGNING_P12_PASS || 'TanBaoAgTechISO2026!');
  const yearsValid = options.yearsValid || 5;

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8)).toUpperCase();
  const now = new Date();
  cert.validity.notBefore = new Date(now.getTime() - 60000);
  cert.validity.notAfter = new Date(now.getTime() + yearsValid * 365 * 24 * 60 * 60 * 1000);

  const attrs = [
    { name: 'commonName', value: cn },
    { name: 'organizationName', value: org },
    { name: 'countryName', value: country }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
    { name: 'extKeyUsage', codeSigning: true, emailProtection: true }
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: '3des',
    friendlyName: org
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, 'binary');
  const derCertBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certFingerprintSha256 = forge.md.sha256.create().update(derCertBytes).digest().toHex();

  return {
    p12Buffer,
    passphrase,
    signer_cn: cn,
    signer_org: org,
    cert_serial: cert.serialNumber,
    cert_fingerprint_sha256: certFingerprintSha256,
    valid_from: cert.validity.notBefore.toISOString(),
    valid_to: cert.validity.notAfter.toISOString()
  };
}

if (require.main === module) {
  const outPath = process.argv[2] || path.join(__dirname, '../certs/enterprise-report-signer.p12');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const generated = createEnterpriseP12Buffer();
  fs.writeFileSync(outPath, generated.p12Buffer);
  console.log(JSON.stringify({
    success: true,
    output: outPath,
    signer_cn: generated.signer_cn,
    signer_org: generated.signer_org,
    cert_serial: generated.cert_serial,
    cert_fingerprint_sha256: generated.cert_fingerprint_sha256,
    base64_preview: generated.p12Buffer.toString('base64').slice(0, 48) + '...'
  }, null, 2));
}

module.exports = { createEnterpriseP12Buffer };
