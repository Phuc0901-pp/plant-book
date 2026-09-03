const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const { buildAll } = require('../../scripts/build-html');

describe('Suite 7: HTML Template Compilation, Tag Balance & Critical DOM IDs Verification', () => {

  const adminHtmlPath = path.join(__dirname, '../../../frontend/admin/index.html');
  const userHtmlPath = path.join(__dirname, '../../../frontend/user/index.html');

  it('7.1 Should execute buildAll() and compile modular templates successfully', () => {
    const result = buildAll();
    expect(result.admin).toBe(true);
    expect(result.user).toBe(true);

    expect(fs.existsSync(adminHtmlPath)).toBe(true);
    expect(fs.existsSync(userHtmlPath)).toBe(true);

    const adminStats = fs.statSync(adminHtmlPath);
    const userStats = fs.statSync(userHtmlPath);

    expect(adminStats.size).toBeGreaterThan(100000); // > 100KB
    expect(userStats.size).toBeGreaterThan(100000); // > 100KB
  });

  it('7.2 Should verify HTML tag balance (div, form, section, select) in admin/index.html', () => {
    const content = fs.readFileSync(adminHtmlPath, 'utf8');

    // Count open and closing divs
    const openDivs = (content.match(/<div[\s>]/gi) || []).length;
    const closeDivs = (content.match(/<\/div>/gi) || []).length;
    const diff = openDivs - closeDivs;

    expect(openDivs).toBeGreaterThan(100);
    expect(diff).toBe(0); // Perfect div balance!

    // Check forms
    const openForms = (content.match(/<form[\s>]/gi) || []).length;
    const closeForms = (content.match(/<\/form>/gi) || []).length;
    expect(openForms).toBe(closeForms);
  });

  it('7.3 Should verify HTML tag balance (div, form, section, select) in user/index.html', () => {
    const content = fs.readFileSync(userHtmlPath, 'utf8');

    // Count open and closing divs
    const openDivs = (content.match(/<div[\s>]/gi) || []).length;
    const closeDivs = (content.match(/<\/div>/gi) || []).length;
    const diff = openDivs - closeDivs;

    expect(openDivs).toBeGreaterThan(100);
    expect(diff).toBe(0); // Perfect div balance!

    // Check forms
    const openForms = (content.match(/<form[\s>]/gi) || []).length;
    const closeForms = (content.match(/<\/form>/gi) || []).length;
    expect(openForms).toBe(closeForms);
  });

  it('7.4 Should verify presence of critical Admin Portal DOM element IDs', () => {
    const content = fs.readFileSync(adminHtmlPath, 'utf8');
    
    const requiredAdminIds = [
      'login-page',
      'gis-map',
      'farm-name',
      'farm-puc-code',
      'farm-vietgap-cert',
      'f-supply-phi-days',
      'f-supply-active-ing',
      'f-supply-target-pests',
      'supply-view-modal',
      'supply-form-modal',
      'qr-modal',
      'page-users',
      'page-database'
    ];

    requiredAdminIds.forEach(id => {
      const hasId = content.includes(`id="${id}"`) || content.includes(`id='${id}'`);
      if (!hasId) {
        throw new Error(`Critical Admin DOM ID "${id}" is missing in admin/index.html`);
      }
      expect(hasId).toBe(true);
    });
  });

  it('7.5 Should verify presence of critical User Portal DOM element IDs (VietGAP & Care)', () => {
    const content = fs.readFileSync(userHtmlPath, 'utf8');
    
    const requiredUserIds = [
      'login-page',
      'c-log-type',
      'c-log-date',
      'c-operator-name',
      'c-equipment-used',
      'care-detail-fields',
      'sp-phi-days',
      'sp-active-ingredient',
      'sp-target-pests',
      'btn-voice-dictate',
      'care-modal',
      'modal-supply'
    ];

    requiredUserIds.forEach(id => {
      const hasId = content.includes(`id="${id}"`) || content.includes(`id='${id}'`);
      if (!hasId) {
        throw new Error(`Critical User DOM ID "${id}" is missing in user/index.html`);
      }
      expect(hasId).toBe(true);
    });
  });

});
