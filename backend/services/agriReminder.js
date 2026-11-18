const CROP_CYCLES = {
  'Sầu riêng': [
    { type: 'Tưới nước & Kiểm tra ẩm độ', cycleDays: 3, priority: 'NORMAL', icon: 'fa-droplet', color: '#0284c7' },
    { type: 'Bón phân hữu cơ vi sinh / NPK', cycleDays: 14, priority: 'HIGH', icon: 'fa-seedling', color: '#059669' },
    { type: 'Phun chế phẩm sinh học phòng ngừa nấm lá', cycleDays: 21, priority: 'HIGH', icon: 'fa-shield-virus', color: '#ea580c' },
    { type: 'Tỉa cành tạo tán & dưỡng đọt non', cycleDays: 45, priority: 'NORMAL', icon: 'fa-scissors', color: '#8b5cf6' },
    { type: 'Kiểm toán quả (Đậu quả / Quả non / Quả chín)', cycleDays: 15, priority: 'HIGH', icon: 'fa-apple-whole', color: '#0d9488' },
    { type: 'Đo pH & Vi lượng tầng rễ tơ', cycleDays: 30, priority: 'NORMAL', icon: 'fa-flask', color: '#06b6d4' }
  ],
  'DEFAULT': [
    { type: 'Tưới nước định kỳ', cycleDays: 3, priority: 'NORMAL', icon: 'fa-droplet', color: '#0284c7' },
    { type: 'Bón phân hữu cơ định kỳ', cycleDays: 15, priority: 'HIGH', icon: 'fa-seedling', color: '#059669' },
    { type: 'Kiểm toán quả (Đậu quả / Quả non / Quả chín)', cycleDays: 15, priority: 'HIGH', icon: 'fa-apple-whole', color: '#0d9488' },
    { type: 'Kiểm tra sâu bệnh', cycleDays: 10, priority: 'HIGH', icon: 'fa-magnifying-glass', color: '#f59e0b' }
  ]
};

function calculateSmartReminders(plants = [], careLogs = []) {
  const reminders = [];
  const now = Date.now();

  const logsByPlant = new Map();
  for (const log of careLogs) {
    if (!logsByPlant.has(log.plant_id)) {
      logsByPlant.set(log.plant_id, []);
    }
    logsByPlant.get(log.plant_id).push(log);
  }

  for (const plant of plants) {
    const plantType = plant.plant_type || 'Sầu riêng';
    const cycleRules = CROP_CYCLES[plantType] || CROP_CYCLES['DEFAULT'];
    const plantLogs = logsByPlant.get(plant.id) || [];

    for (const rule of cycleRules) {
      const matchingLogs = plantLogs.filter(l => (l.log_type || '').toLowerCase().includes(rule.type.toLowerCase()) || (l.notes || '').toLowerCase().includes(rule.type.toLowerCase()));

      let lastCareTime = null;
      if (matchingLogs.length > 0) {
        lastCareTime = new Date(matchingLogs[0].created_at || matchingLogs[0].care_date).getTime();
      } else if (plant.created_at) {
        lastCareTime = new Date(plant.created_at).getTime();
      } else {
        lastCareTime = now - (rule.cycleDays * 24 * 60 * 60 * 1000);
      }

      const daysElapsed = Math.floor((now - lastCareTime) / (24 * 60 * 60 * 1000));
      const daysRemaining = rule.cycleDays - daysElapsed;

      if (daysRemaining <= 2) {
        const isOverdue = daysRemaining < 0;
        reminders.push({
          plantId: plant.id,
          treeCode: plant.tree_code || plant.id,
          plantType: plant.plant_type || 'Cây trồng',
          farmId: plant.farm_id,
          taskType: rule.type,
          icon: rule.icon,
          color: rule.color,
          priority: isOverdue ? 'CRITICAL' : rule.priority,
          daysElapsed,
          daysRemaining,
          isOverdue,
          message: isOverdue
            ? `Đã quá hạn ${Math.abs(daysRemaining)} ngày: ${rule.type} cho Cây #${plant.tree_code || plant.id}`
            : `Đến chu kỳ (${daysRemaining === 0 ? 'Hôm nay' : `Còn ${daysRemaining} ngày`}): ${rule.type} cho Cây #${plant.tree_code || plant.id}`
        });
      }
    }
  }

  reminders.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.daysRemaining - b.daysRemaining;
  });

  return reminders;
}

module.exports = {
  CROP_CYCLES,
  calculateSmartReminders
};
