const zaloService = require('./zaloService');

function getDb(opts) {
  return (opts && opts.dbPool) ? opts.dbPool : require('../config/db');
}

const SEVERITY_TO_TYPE = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  success: 'success',
  audit_silent: 'info'
};

function resolveSoundProfile(severity, overrideProfile) {
  if (overrideProfile && ['siren', 'alert_double', 'chime', 'silent'].includes(overrideProfile)) {
    return overrideProfile;
  }
  switch (String(severity || 'info').toLowerCase()) {
    case 'danger':
      return 'siren';
    case 'warning':
      return 'alert_double';
    case 'audit_silent':
      return 'silent';
    default:
      return 'chime';
  }
}

function parseHmMinutes(hm) {
  const m = String(hm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function isWithinQuietHours(pref, nowDate = new Date()) {
  if (!pref || !pref.quiet_hours_enabled) return false;
  const startMin = parseHmMinutes(pref.quiet_start || '22:00');
  const endMin = parseHmMinutes(pref.quiet_end || '06:00');
  if (startMin === null || endMin === null) return false;
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  if (startMin === endMin) return true;
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

async function resolveFarmRecipients(farmId, includeAdmins = false, dbPool = null) {
  const pool = getDb({ dbPool });
  const ids = new Set();
  if (farmId && pool && typeof pool.query === 'function') {
    try {
      const farmRes = await pool.query(
        'SELECT user_id FROM farms WHERE id = $1 LIMIT 1',
        [farmId]
      );
      const ownerId = farmRes && farmRes.rows && farmRes.rows[0] ? farmRes.rows[0].user_id : null;
      if (ownerId) {
        ids.add(Number(ownerId));
        const subRes = await pool.query(
          `SELECT id FROM users
           WHERE (parent_user_id = $1 OR farm_id = $2)
             AND approved IS NOT FALSE
             AND COALESCE(sub_role, 'farm_owner') IN ('farm_owner', 'farm_manager')`,
          [ownerId, farmId]
        );
        if (subRes && Array.isArray(subRes.rows)) {
          subRes.rows.forEach(r => { if (r.id) ids.add(Number(r.id)); });
        }
      }
    } catch (_) {}
  }
  if (includeAdmins) {
    const admins = await resolveAdminRecipients(dbPool);
    admins.forEach(id => ids.add(id));
  }
  return Array.from(ids);
}

async function resolveAdminRecipients(dbPool = null) {
  const pool = getDb({ dbPool });
  if (!pool || typeof pool.query !== 'function') return [];
  try {
    const res = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' AND approved IS NOT FALSE"
    );
    return (res && Array.isArray(res.rows)) ? res.rows.map(r => Number(r.id)).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

async function getUserPreference(userId, dbPool = null) {
  const pool = getDb({ dbPool });
  const fallback = {
    user_id: userId,
    sound_enabled: true,
    sound_profile: 'chime',
    quiet_hours_enabled: false,
    quiet_start: '22:00',
    quiet_end: '06:00',
    muted_categories: []
  };
  if (!userId || !pool || typeof pool.query !== 'function') return fallback;
  try {
    const res = await pool.query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (res && res.rows && res.rows[0]) {
      return { ...fallback, ...res.rows[0] };
    }
  } catch (_) {}
  return fallback;
}

async function dispatchToSingleUser(userId, opts) {
  const pool = getDb(opts);
  const {
    eventCode = 'SYSTEM_EVENT',
    severity = 'info',
    soundProfile,
    title,
    message,
    farmId = null,
    entityType = null,
    entityId = null,
    actorUserId = null,
    metadata = {},
    batchKey = null,
    batchMessage = null,
    sendZalo = true
  } = opts;

  const normalizedSeverity = String(severity || 'info').toLowerCase();
  const type = SEVERITY_TO_TYPE[normalizedSeverity] || 'info';
  const baseSound = resolveSoundProfile(normalizedSeverity, soundProfile);
  const pref = await getUserPreference(userId, pool);
  const mutedList = Array.isArray(pref.muted_categories) ? pref.muted_categories : [];
  const isMuted = normalizedSeverity !== 'danger' && mutedList.includes(eventCode);
  const quietActive = isWithinQuietHours(pref);
  const effectiveSound = (normalizedSeverity === 'danger')
    ? baseSound
    : ((!pref.sound_enabled || quietActive || isMuted) ? 'silent' : (baseSound === 'chime' && pref.sound_profile ? pref.sound_profile : baseSound));

  let savedRow = null;
  if (pool && typeof pool.query === 'function') {
    if (batchKey) {
      const existingRes = await pool.query(
        `SELECT id, metadata FROM user_notifications
         WHERE user_id = $1
           AND is_read = false
           AND (is_archived = false OR is_archived IS NULL)
           AND metadata->>'batch_key' = $2
           AND created_at > NOW() - INTERVAL '60 seconds'
         ORDER BY id DESC
         LIMIT 1`,
        [userId, String(batchKey)]
      );
      if (existingRes && existingRes.rows && existingRes.rows[0]) {
        const prev = existingRes.rows[0];
        const prevMeta = (prev.metadata && typeof prev.metadata === 'object') ? prev.metadata : {};
        const nextCount = Number(prevMeta.batch_count || 1) + 1;
        const nextMeta = { ...prevMeta, ...metadata, batch_key: String(batchKey), batch_count: nextCount };
        const nextMessage = typeof batchMessage === 'function'
          ? batchMessage(nextCount)
          : `${message} (gộp ${nextCount} thao tác liên tiếp)`;
        const updRes = await pool.query(
          `UPDATE user_notifications
           SET message = $1, metadata = $2, sound_profile = $3
           WHERE id = $4
           RETURNING *`,
          [nextMessage, JSON.stringify(nextMeta), effectiveSound, prev.id]
        );
        savedRow = (updRes && updRes.rows && updRes.rows[0]) ? updRes.rows[0] : {
          id: prev.id,
          user_id: userId,
          farm_id: farmId,
          title,
          message: nextMessage,
          type,
          event_code: eventCode,
          severity: normalizedSeverity,
          sound_profile: effectiveSound,
          metadata: nextMeta,
          is_read: false,
          created_at: new Date().toISOString()
        };
      }
    }

    if (!savedRow) {
      const finalMeta = batchKey
        ? { ...metadata, batch_key: String(batchKey), batch_count: 1 }
        : (metadata || {});
      const insRes = await pool.query(
        `INSERT INTO user_notifications
          (user_id, farm_id, title, message, type, event_code, severity, sound_profile, entity_type, entity_id, actor_user_id, metadata, is_read, is_archived)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, false)
         RETURNING *`,
        [
          userId,
          farmId || null,
          String(title || 'Thông báo hệ thống').slice(0, 250),
          String(message || ''),
          type,
          String(eventCode || 'SYSTEM_EVENT').slice(0, 80),
          normalizedSeverity,
          effectiveSound,
          entityType || null,
          entityId ? Number(entityId) : null,
          actorUserId ? Number(actorUserId) : null,
          JSON.stringify(finalMeta)
        ]
      );
      savedRow = (insRes && insRes.rows && insRes.rows[0]) ? insRes.rows[0] : {
        user_id: userId,
        farm_id: farmId,
        title,
        message,
        type,
        event_code: eventCode,
        severity: normalizedSeverity,
        sound_profile: effectiveSound,
        entity_type: entityType,
        entity_id: entityId,
        metadata: finalMeta,
        is_read: false,
        created_at: new Date().toISOString()
      };
    }
  }

  if (typeof global.broadcastWS === 'function') {
    global.broadcastWS('new_notification', {
      target_user_id: Number(userId),
      notification: savedRow,
      sound_profile: effectiveSound,
      severity: normalizedSeverity
    });
  }

  if (normalizedSeverity === 'danger' && sendZalo !== false && pool && typeof pool.query === 'function') {
    try {
      const uRes = await pool.query('SELECT phone FROM users WHERE id = $1 LIMIT 1', [userId]);
      const phone = uRes && uRes.rows && uRes.rows[0] ? uRes.rows[0].phone : null;
      if (phone) {
        zaloService.sendZaloSecurityAlert({
          phone,
          farmName: metadata?.farm_name || 'Hệ thống Tân Bảo',
          treeCode: metadata?.tree_code || String(entityId || 'SYSTEM'),
          reason: `${title}: ${message}`,
          severity: 'CRITICAL'
        }).catch(() => {});
      }
    } catch (_) {}
  }

  return savedRow;
}

async function dispatchNotification(opts = {}) {
  try {
    const rawRecipients = Array.isArray(opts.recipients) ? opts.recipients : [];
    const recipientSet = new Set(rawRecipients.map(id => Number(id)).filter(Boolean));
    if (recipientSet.size === 0 && opts.farmId) {
      const farmUsers = await resolveFarmRecipients(opts.farmId, Boolean(opts.includeAdmins), opts.dbPool);
      farmUsers.forEach(id => recipientSet.add(id));
    } else if (opts.includeAdmins) {
      const admins = await resolveAdminRecipients(opts.dbPool);
      admins.forEach(id => recipientSet.add(id));
    }

    if (opts.excludeActor && opts.actorUserId) {
      recipientSet.delete(Number(opts.actorUserId));
    }

    const dispatched = [];
    for (const uid of recipientSet) {
      const row = await dispatchToSingleUser(uid, opts);
      if (row) dispatched.push(row);
    }
    return dispatched;
  } catch (_) {
    return [];
  }
}

async function notifyFarmEvent(farmId, opts = {}) {
  return dispatchNotification({ ...opts, farmId });
}

async function notifyAdmins(opts = {}) {
  const admins = await resolveAdminRecipients(opts.dbPool);
  return dispatchNotification({ ...opts, recipients: admins, includeAdmins: true });
}

async function notifyUser(userId, opts = {}) {
  if (!userId) return [];
  return dispatchNotification({ ...opts, recipients: [Number(userId)] });
}

module.exports = {
  resolveSoundProfile,
  isWithinQuietHours,
  resolveFarmRecipients,
  resolveAdminRecipients,
  dispatchNotification,
  notifyFarmEvent,
  notifyAdmins,
  notifyUser
};
