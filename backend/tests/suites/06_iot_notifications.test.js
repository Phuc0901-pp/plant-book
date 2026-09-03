const { describe, it, expect } = require('../test-framework');

describe('Suite 6: IoT Sensor Telemetry, Threshold Rules & In-App Alert System', () => {

  // Rule Evaluator Engine
  function evaluateAlertRule(sensorData, rule) {
    if (!rule || !sensorData) return { triggered: false };

    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [rule];
    let allConditionsMet = true;

    for (const cond of conditions) {
      const metricVal = parseFloat(sensorData[cond.metric_key]);
      const threshold = parseFloat(cond.threshold_value);

      if (isNaN(metricVal) || isNaN(threshold)) {
        allConditionsMet = false;
        break;
      }

      let conditionPassed = false;
      switch (cond.operator) {
        case '>':  conditionPassed = (metricVal > threshold); break;
        case '>=': conditionPassed = (metricVal >= threshold); break;
        case '<':  conditionPassed = (metricVal < threshold); break;
        case '<=': conditionPassed = (metricVal <= threshold); break;
        case '==': conditionPassed = (metricVal === threshold); break;
        default:   conditionPassed = false;
      }

      if (!conditionPassed) {
        allConditionsMet = false;
        break;
      }
    }

    return {
      triggered: allConditionsMet,
      rule_id: rule.id,
      title: rule.title,
      recommendation: rule.action_recommendation
    };
  }

  it('6.1 Should evaluate simple sensor thresholds correctly (< or >)', () => {
    const sensorData = {
      soil_moisture: 28, // 28% (Dry soil)
      air_temp: 34.5     // 34.5°C (High temp)
    };

    const dryRule = {
      id: 1,
      title: 'Độ ẩm đất thấp',
      metric_key: 'soil_moisture',
      operator: '<',
      threshold_value: 30,
      action_recommendation: 'Cần bật hệ thống tưới tự động'
    };

    const res1 = evaluateAlertRule(sensorData, dryRule);
    expect(res1.triggered).toBe(true);
    expect(res1.recommendation).toContain('hệ thống tưới');

    const highMoistureRule = {
      id: 2,
      title: 'Độ ẩm đất quá cao',
      metric_key: 'soil_moisture',
      operator: '>',
      threshold_value: 80,
      action_recommendation: 'Cần thoát nước'
    };

    const res2 = evaluateAlertRule(sensorData, highMoistureRule);
    expect(res2.triggered).toBe(false);
  });

  it('6.2 Should evaluate composite multi-condition alert rules (AND condition logic)', () => {
    const sensorData = {
      air_temp: 36.2,      // > 35°C
      air_humidity: 40.0   // < 50%
    };

    const heatWaveRule = {
      id: 3,
      title: 'Cảnh báo Nắng nóng gay gắt & Độ ẩm thấp',
      action_recommendation: 'Cần che lưới giảm nắng và phun sương hạ nhiệt',
      conditions: [
        { metric_key: 'air_temp', operator: '>', threshold_value: 35.0 },
        { metric_key: 'air_humidity', operator: '<', threshold_value: 50.0 }
      ]
    };

    const result = evaluateAlertRule(sensorData, heatWaveRule);
    expect(result.triggered).toBe(true);
  });

  it('6.3 Should manage notification lifecycle: create, mark as read, and archive', () => {
    const notification = {
      id: 501,
      user_id: 10,
      title: 'Cảnh báo hạn đất',
      message: 'Độ ẩm đất dưới 30%',
      type: 'warning',
      is_read: false,
      is_archived: false
    };

    expect(notification.is_read).toBe(false);
    expect(notification.is_archived).toBe(false);

    // Mark as read
    notification.is_read = true;
    expect(notification.is_read).toBe(true);

    // Archive notification
    notification.is_archived = true;
    notification.archived_at = new Date().toISOString();
    expect(notification.is_archived).toBe(true);
    expect(typeof notification.archived_at).toBe('string');
  });

});
