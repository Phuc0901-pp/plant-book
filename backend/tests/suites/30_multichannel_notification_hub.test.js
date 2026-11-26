const fs = require('fs');
const path = require('path');
const { describe, test, assert } = require('../test-framework');

const rootDir = path.resolve(__dirname, '../../..');

describe('Suite 30: Multi-Platform Notification Hub (Web, Admin, SW Push & Flutter Mobile)', () => {
  test('30.1 [NOTIF-01] Migration 019, notificationDispatcher ringtones, 60s batching, Quiet Hours & WS target isolation', async () => {
    const dbPath = require.resolve('../../config/db');
    const dispPath = require.resolve('../../services/notificationDispatcher');
    const origDb = require.cache[dbPath];
    const origDisp = require.cache[dispPath];
    const origBroadcast = global.broadcastWS;

    try {
      const notifications = [];
      const broadcasts = [];
      const mockPool = {
        async query(sql, params = []) {
          const s = String(sql).replace(/\s+/g, ' ').trim();
          if (s.includes('FROM user_notification_preferences')) {
            if (params[0] === 88) {
              return { rows: [{ user_id: 88, sound_enabled: true, sound_profile: 'chime', quiet_hours_enabled: true, quiet_start: '00:00', quiet_end: '23:59', muted_categories: [] }] };
            }
            return { rows: [] };
          }
          if (s.includes('FROM user_notifications WHERE user_id = $1 AND is_read = false')) {
            const hit = notifications.find(n => n.user_id === params[0] && n.metadata && n.metadata.batch_key === params[1]);
            return { rows: hit ? [hit] : [] };
          }
          if (s.startsWith('UPDATE user_notifications SET message = $1')) {
            const target = notifications.find(n => n.id === params[3]);
            if (target) {
              target.message = params[0];
              target.metadata = JSON.parse(params[1]);
              target.sound_profile = params[2];
            }
            return { rows: target ? [target] : [] };
          }
          if (s.startsWith('INSERT INTO user_notifications')) {
            const row = {
              id: notifications.length + 1,
              user_id: params[0],
              farm_id: params[1],
              title: params[2],
              message: params[3],
              type: params[4],
              event_code: params[5],
              severity: params[6],
              sound_profile: params[7],
              metadata: JSON.parse(params[11] || '{}'),
              is_read: false
            };
            notifications.push(row);
            return { rows: [row] };
          }
          if (s.includes('FROM farms WHERE id = $1')) return { rows: [{ user_id: 99 }] };
          return { rows: [] };
        }
      };

      global.broadcastWS = (event, data) => broadcasts.push({ event, data });
      require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPool };
      delete require.cache[dispPath];
      const dispatcher = require('../../services/notificationDispatcher');

      assert.strictEqual(dispatcher.resolveSoundProfile('danger'), 'siren');
      assert.strictEqual(dispatcher.resolveSoundProfile('warning'), 'alert_double');
      assert.strictEqual(dispatcher.resolveSoundProfile('info'), 'chime');
      assert.strictEqual(dispatcher.resolveSoundProfile('audit_silent'), 'silent');

      const overnight = { quiet_hours_enabled: true, quiet_start: '22:00', quiet_end: '06:00' };
      assert.strictEqual(dispatcher.isWithinQuietHours(overnight, new Date('2026-11-26T23:10:00')), true);
      assert.strictEqual(dispatcher.isWithinQuietHours(overnight, new Date('2026-11-26T04:50:00')), true);
      assert.strictEqual(dispatcher.isWithinQuietHours(overnight, new Date('2026-11-26T10:30:00')), false);

      await dispatcher.notifyUser(88, { eventCode: 'CARE_LOG_CREATED', severity: 'info', title: 'Canh tác', message: 'Tưới nước', sendZalo: false });
      assert.strictEqual(broadcasts[0].data.sound_profile, 'silent');
      await dispatcher.notifyUser(88, { eventCode: 'DLP_EXFILTRATION_BLOCKED', severity: 'danger', title: 'An ninh', message: 'DLP', sendZalo: false });
      assert.strictEqual(broadcasts[1].data.sound_profile, 'siren');

      await dispatcher.notifyFarmEvent(12, {
        eventCode: 'NFC_TAG_ASSIGNED',
        severity: 'info',
        title: 'Gắn thẻ NFC',
        message: 'Gắn thẻ 1',
        batchKey: 'nfc_assign:12:5',
        batchMessage: c => `Đã gắn ${c} thẻ NFC`,
        sendZalo: false
      });
      await dispatcher.notifyFarmEvent(12, {
        eventCode: 'NFC_TAG_ASSIGNED',
        severity: 'info',
        title: 'Gắn thẻ NFC',
        message: 'Gắn thẻ 2',
        batchKey: 'nfc_assign:12:5',
        batchMessage: c => `Đã gắn ${c} thẻ NFC`,
        sendZalo: false
      });
      const nfcRows = notifications.filter(n => n.event_code === 'NFC_TAG_ASSIGNED');
      assert.strictEqual(nfcRows.length, 1);
      assert.strictEqual(nfcRows[0].metadata.batch_count, 2);

      const mig019 = fs.readFileSync(path.join(rootDir, 'backend/db/migrations/019_notification_hub_multichannel.sql'), 'utf8');
      const initSrc = fs.readFileSync(path.join(rootDir, 'backend/db/init.js'), 'utf8');
      const serverSrc = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
      const notifRouteSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/notifications.js'), 'utf8');
      assert.ok(mig019.includes('user_notification_preferences') && mig019.includes('user_push_tokens'));
      assert.ok(initSrc.includes('user_notification_preferences') && initSrc.includes('user_push_tokens'));
      assert.ok(serverSrc.includes("if (event === 'new_notification')"));
      assert.ok(notifRouteSrc.includes("'/preferences'") && notifRouteSrc.includes("'/push-token'") && notifRouteSrc.includes("'/test'"));
    } finally {
      if (origDb) require.cache[dbPath] = origDb; else delete require.cache[dbPath];
      if (origDisp) require.cache[dispPath] = origDisp; else delete require.cache[dispPath];
      global.broadcastWS = origBroadcast;
    }
  });

  test('30.2 [NOTIF-02] Business & security notification hooks wired across NFC, care logs, auth, IP/DLP guards & IoT', () => {
    const nfcSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/nfc.routes.js'), 'utf8');
    const mediaSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/media-logs.routes.js'), 'utf8');
    const coreSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/core.routes.js'), 'utf8');
    const authSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/auth.js'), 'utf8');
    const usersSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/users.js'), 'utf8');
    const historySrc = fs.readFileSync(path.join(rootDir, 'backend/routes/history.js'), 'utf8');
    const farmsSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/farms.js'), 'utf8');
    const devicesSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/devices.js'), 'utf8');
    const ipGuardSrc = fs.readFileSync(path.join(rootDir, 'backend/middleware/adminIpGuard.js'), 'utf8');
    const dlpSrc = fs.readFileSync(path.join(rootDir, 'backend/middleware/dlpAntiExfiltration.js'), 'utf8');

    assert.ok(nfcSrc.includes('NFC_TAG_ASSIGNED') && nfcSrc.includes('NFC_TAG_UNASSIGNED') && nfcSrc.includes('NFC_SECURITY_ALERT'));
    assert.ok(mediaSrc.includes('CARE_LOG_CREATED') && mediaSrc.includes('CARE_LOG_UPDATED') && mediaSrc.includes('DATA_DELETED') && mediaSrc.includes('PHI_HARVEST_BLOCKED'));
    assert.ok(coreSrc.includes('PLANT_UPDATED') && coreSrc.includes('PLANT_GPS_UPDATED'));
    assert.ok(authSrc.includes('ACCOUNT_LOCKED') && authSrc.includes('SUB_ACCOUNT_LOGIN') && authSrc.includes('USER_REGISTERED') && authSrc.includes('SESSION_KILL_SWITCH'));
    assert.ok(usersSrc.includes('ACCOUNT_APPROVED'));
    assert.ok(historySrc.includes('DATA_RESTORED'));
    assert.ok(farmsSrc.includes('FARM_DELETED') && farmsSrc.includes('FARM_SOFT_DELETED'));
    assert.ok(devicesSrc.includes('IOT_THRESHOLD_EXCEEDED'));
    assert.ok(ipGuardSrc.includes('ADMIN_IP_FORBIDDEN'));
    assert.ok(dlpSrc.includes('DLP_EXFILTRATION_BLOCKED'));
  });

  test('30.3 [NOTIF-03] Web User & Admin real-time bell, 4 Web Audio ringtones, WS JWT & Service Worker push', () => {
    const userNotifJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/notifications.js'), 'utf8');
    const userWsJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/core/websocket.js'), 'utf8');
    const userSwJs = fs.readFileSync(path.join(rootDir, 'frontend/user/sw.js'), 'utf8');
    const userHtml = fs.readFileSync(path.join(rootDir, 'frontend/user/index.html'), 'utf8');
    const adminNotifJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/notifications.js'), 'utf8');
    const adminWsJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/websocket.js'), 'utf8');
    const adminHtml = fs.readFileSync(path.join(rootDir, 'frontend/admin/index.html'), 'utf8');

    assert.ok(userNotifJs.includes('playDoubleAlert') && userNotifJs.includes('handleIncomingRealtimeNotification'));
    assert.ok(userNotifJs.includes('toggleUserNotifSound') && userNotifJs.includes('toggleUserQuietHours'));
    assert.ok(userWsJs.includes('?token=${encodeURIComponent(token)}') && userWsJs.includes("event === 'new_notification'") && userWsJs.includes("event === 'iot_telemetry_updated'"));
    assert.ok(userSwJs.includes("addEventListener('push'") && userSwJs.includes("addEventListener('notificationclick'"));
    assert.ok(userHtml.includes('user-notif-mute-btn') && userHtml.includes('user-notif-quiet-btn'));
    assert.ok(adminNotifJs.includes('handleAdminRealtimeNotification') && adminNotifJs.includes('playAdminNotificationSound'));
    assert.ok(adminWsJs.includes('?token=${encodeURIComponent(wsToken)}') && adminWsJs.includes("event === 'new_notification'"));
    assert.ok(adminHtml.includes('admin-notif-badge') && adminHtml.includes('/admin/js/notifications.js'));
  });

  test('30.4 [NOTIF-04] Flutter Mobile NotificationService, 2 Android channels, WS Bearer JWT & 2-tab AlertsPage', () => {
    const manifestXml = fs.readFileSync(path.join(rootDir, 'mobile_app/android/app/src/main/AndroidManifest.xml'), 'utf8');
    const pubspecYaml = fs.readFileSync(path.join(rootDir, 'mobile_app/pubspec.yaml'), 'utf8');
    const wsDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/websocket_service.dart'), 'utf8');
    const apiDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/api_service.dart'), 'utf8');
    const notifDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/notification_service.dart'), 'utf8');
    const alertsDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/pages/alerts_page.dart'), 'utf8');
    const dashDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/pages/dashboard_page.dart'), 'utf8');
    const adminDashDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/pages/admin/admin_dashboard_page.dart'), 'utf8');

    assert.ok(manifestXml.includes('POST_NOTIFICATIONS') && manifestXml.includes('VIBRATE'));
    assert.ok(pubspecYaml.includes('flutter_local_notifications'));
    assert.ok(wsDart.includes("'Authorization': 'Bearer $authToken'"));
    assert.ok(apiDart.includes('fetchNotifications') && apiDart.includes('updateNotificationPreferences') && apiDart.includes('registerPushToken'));
    assert.ok(notifDart.includes('tbsg_critical_alerts') && notifDart.includes('tbsg_general_updates') && notifDart.includes('HapticFeedback.heavyImpact'));
    assert.ok(alertsDart.includes('DefaultTabController') && alertsDart.includes('_openPreferencesSheet') && alertsDart.includes('Hộp thư Thông báo'));
    assert.ok(dashDart.includes('NotificationService().init()') && dashDart.includes('AlertsPage()'));
    assert.ok(adminDashDart.includes('NotificationService().init()') && adminDashDart.includes('AlertsPage()'));
  });
});
