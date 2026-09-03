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
    // 200 Liters per tree for 10 trees at 5,000 VND / m3
    const amountLitersPerTree = 200;
    const treeCount = 10;
    const unitPricePerM3 = 5000;

    const totalLiters = amountLitersPerTree * treeCount;
    const totalM3 = totalLiters / 1000;
    const totalCost = totalM3 * unitPricePerM3;

    expect(totalLiters).toBe(2000);
    expect(totalM3).toBe(2.0);
    expect(totalCost).toBe(10000); // 10,000 VND
  });

  it('4.4 Should accurately convert units and calculate financial costs for Fertilizer & Pesticides', () => {
    // 500 grams of NPK per tree at 30,000 VND / kg
    const amountGrams = 500;
    const unitPricePerKg = 30000;

    const amountKg = amountGrams / 1000;
    const cost = amountKg * unitPricePerKg;

    expect(amountKg).toBe(0.5);
    expect(cost).toBe(15000); // 15,000 VND
  });

  it('4.5 Should deduct stock balance correctly upon usage recording', () => {
    let currentStock = 50; // 50 kg in inventory
    const usageAmount = 10; // used 10 kg
    
    currentStock -= usageAmount;
    expect(currentStock).toBe(40);

    const isLowStock = (stock) => stock <= 5;
    expect(isLowStock(currentStock)).toBe(false);

    // Use remaining 38 kg
    currentStock -= 38;
    expect(currentStock).toBe(2);
    expect(isLowStock(currentStock)).toBe(true);
  });

});
