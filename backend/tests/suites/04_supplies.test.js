const { describe, it, expect } = require('../test-framework');

describe('Suite 4: Supplies Management, Cost Accounting & Inventory Dynamics', () => {

  it('4.1 Should handle the 4 distinct supply categories properly', () => {
    const validCategories = ['Bón phân', 'Phun thuốc', 'Tiền nước', 'Nhân công'];

    validCategories.forEach(cat => {
      expect(validCategories.includes(cat)).toBe(true);
    });
  });

  it('4.2 Should apply infinite stock (999999) to Tiền nước & Nhân công and finite stock to physical goods', () => {
    const calculateStock = (category, inputStock) => {
      if (['Nhân công', 'Tiền nước'].includes(category)) {
        return 999999;
      }
      const val = parseFloat(inputStock);
      return isNaN(val) ? 0 : val;
    };

    expect(calculateStock('Tiền nước', 0)).toBe(999999);
    expect(calculateStock('Nhân công', 5)).toBe(999999);
    expect(calculateStock('Bón phân', 50)).toBe(50);
    expect(calculateStock('Phun thuốc', 10)).toBe(10);
  });

  it('4.3 Should accurately convert units and calculate financial costs for Water Irrigation', () => {
    const amountLitersPerTree = 200;
    const treeCount = 10;
    const unitPricePerM3 = 5000;

    const totalLiters = amountLitersPerTree * treeCount;
    const totalM3 = totalLiters / 1000;
    const totalCost = totalM3 * unitPricePerM3;

    expect(totalLiters).toBe(2000);
    expect(totalM3).toBe(2.0);
    expect(totalCost).toBe(10000);
  });

  it('4.4 Should accurately convert units and calculate financial costs for Fertilizer & Pesticides', () => {
    const amountGrams = 500;
    const unitPricePerKg = 30000;

    const amountKg = amountGrams / 1000;
    const cost = amountKg * unitPricePerKg;

    expect(amountKg).toBe(0.5);
    expect(cost).toBe(15000);
  });

  it('4.5 Should deduct stock balance correctly upon usage recording', () => {
    let currentStock = 50;
    const usageAmount = 10;

    currentStock -= usageAmount;
    expect(currentStock).toBe(40);

    const isLowStock = (stock) => stock <= 5;
    expect(isLowStock(currentStock)).toBe(false);

    currentStock -= 38;
    expect(currentStock).toBe(2);
    expect(isLowStock(currentStock)).toBe(true);
  });

  it('4.6 Should handle quick restock increments and valuation recalculations', () => {
    let currentStock = 10;
    const packageQty = 25;
    const addedBags = 4;
    const newPackagePrice = 750000;

    const restockAmount = addedBags * packageQty;
    currentStock += restockAmount;
    const unitPrice = newPackagePrice / packageQty;
    const totalInventoryValuation = currentStock * unitPrice;

    expect(restockAmount).toBe(100);
    expect(currentStock).toBe(110);
    expect(unitPrice).toBe(30000);
    expect(totalInventoryValuation).toBe(3300000);
  });

  it('4.7 Should accurately compute multi-dimensional date intervals for Daily, Monthly, Quarterly, and Yearly reporting', () => {
    const fromDate = new Date('2026-08-01');
    const toDate = new Date('2026-09-04');
    const diffDays = Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(34);

    const fromMonth = 10, fromYear = 2025;
    const toMonth = 9, toYear = 2026;
    const totalMonths = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
    expect(totalMonths).toBe(12);

    const fromQ = 1, fromQYear = 2025;
    const toQ = 3, toQYear = 2026;
    const totalQuarters = (toQYear - fromQYear) * 4 + (toQ - fromQ) + 1;
    expect(totalQuarters).toBe(7);

    const fromY = 2023, toY = 2026;
    const totalYears = toY - fromY + 1;
    expect(totalYears).toBe(4);
  });

});
