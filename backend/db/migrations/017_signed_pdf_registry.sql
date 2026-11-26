-- +migrate Up
CREATE TABLE IF NOT EXISTS signed_report_certificates (
  id SERIAL PRIMARY KEY,
  cert_uuid VARCHAR(64) UNIQUE NOT NULL,
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
  standard_code VARCHAR(80) DEFAULT 'vietgap_globalgap_iso',
  document_sha256 VARCHAR(64) NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  signature_b64 TEXT NOT NULL,
  signer_cn VARCHAR(255) NOT NULL,
  signer_org VARCHAR(255) DEFAULT 'Tan Bao Sai Gon AgTech',
  cert_serial VARCHAR(128) NOT NULL,
  cert_fingerprint_sha256 VARCHAR(64) NOT NULL,
  total_logs INTEGER DEFAULT 0,
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signed_pdf_cert_uuid ON signed_report_certificates(cert_uuid);
CREATE INDEX IF NOT EXISTS idx_signed_pdf_doc_sha256 ON signed_report_certificates(document_sha256);
CREATE INDEX IF NOT EXISTS idx_signed_pdf_farm_id ON signed_report_certificates(farm_id);
