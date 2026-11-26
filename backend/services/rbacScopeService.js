function getEffectiveSubRole(user) {
  if (!user) return 'anonymous';
  if (user.role === 'admin') return 'admin';
  return String(user.sub_role || 'farm_owner').toLowerCase();
}

function isFinanceRedactedForUser(user) {
  if (!user || user.role === 'admin') return false;
  if (user.allow_view_finance === false) return true;
  const sr = getEffectiveSubRole(user);
  if ((sr === 'care_worker' || sr === 'auditor_readonly') && user.allow_view_finance !== true) {
    return true;
  }
  return false;
}

function canUserWriteFarmData(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getEffectiveSubRole(user) !== 'auditor_readonly';
}

function canUserDeleteFarmData(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const sr = getEffectiveSubRole(user);
  return sr === 'farm_owner' || sr === 'farm_manager';
}

function resolveUserTenantScope(user) {
  if (!user) {
    return { isAdmin: false, ownerUserId: null, assignedFarmId: null, assignedPlantIds: [] };
  }
  const isAdmin = user.role === 'admin';
  const ownerUserId = user.parent_user_id ? parseInt(user.parent_user_id, 10) : parseInt(user.id, 10);
  const assignedFarmId = user.farm_id ? parseInt(user.farm_id, 10) : null;
  const assignedPlantIds = Array.isArray(user.assigned_plant_ids)
    ? user.assigned_plant_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0)
    : [];
  return { isAdmin, ownerUserId, assignedFarmId, assignedPlantIds };
}

module.exports = {
  getEffectiveSubRole,
  isFinanceRedactedForUser,
  canUserWriteFarmData,
  canUserDeleteFarmData,
  resolveUserTenantScope
};
