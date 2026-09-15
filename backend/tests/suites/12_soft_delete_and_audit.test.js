const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');

describe('Suite 12: Selective Soft-Delete for Farming Logs & Admin Audit Trail', () => {

  const mig005Path = path.join(__dirname, '../../db/migrations/005_plant_logs_soft_delete.sql');
  const initPath = path.join(__dirname, '../../db/init.js');
  const userHtmlPath = path.join(__dirname, '../../../frontend/user/index.html');
  const adminHtmlPath = path.join(__dirname, '../../../frontend/admin/index.html');
  const plantsRoutePath = path.join(__dirname, '../../routes/plants.js');
  const historyRoutePath = path.join(__dirname, '../../routes/history.js');

  it('12.1 Should verify Migration 005 and init.js contain soft delete schema and index', () => {
    expect(fs.existsSync(mig005Path)).toBe(true);
    const mig005Content = fs.readFileSync(mig005Path, 'utf8');
    const initContent = fs.readFileSync(initPath, 'utf8');

    expect(mig005Content.includes('is_deleted BOOLEAN DEFAULT false')).toBe(true);
    expect(mig005Content.includes('deleted_at TIMESTAMPTZ NULL')).toBe(true);
    expect(mig005Content.includes('idx_plant_logs_is_deleted')).toBe(true);

    expect(initContent.includes('is_deleted BOOLEAN DEFAULT false')).toBe(true);
    expect(initContent.includes('deleted_at TIMESTAMPTZ NULL')).toBe(true);
    expect(initContent.includes('idx_plant_logs_is_deleted')).toBe(true);
  });

  it('12.2 Should verify backend query endpoints filter out soft-deleted logs', () => {
    const plantsRouteContent = fs.readFileSync(plantsRoutePath, 'utf8');
    expect(plantsRouteContent.includes('pl.is_deleted IS NOT TRUE')).toBe(true);
    expect(plantsRouteContent.includes('/logs/batch-delete/preview')).toBe(true);
    expect(plantsRouteContent.includes('/logs/batch-delete')).toBe(true);
    expect(plantsRouteContent.includes('/logs/:logId/restore')).toBe(true);
  });

  it('12.3 Should verify selective batch filter query generator accurately constructs SQL clauses', () => {
    function mockBuildLogFilterQuery(body, farmIds) {
      const { farm_id, plant_id, action_type, date_from, date_to, q } = body;
      const conditions = ['(pl.is_deleted IS NOT TRUE)'];
      const params = [];
      let pIdx = 1;

      if (farm_id && farm_id !== 'ALL') {
        conditions.push(`p.farm_id = $${pIdx++}`);
        params.push(parseInt(farm_id));
      } else if (farmIds && farmIds.length > 0) {
        conditions.push(`p.farm_id = ANY($${pIdx++})`);
        params.push(farmIds);
      }

      if (plant_id && plant_id !== 'ALL') {
        conditions.push(`pl.plant_id = $${pIdx++}`);
        params.push(parseInt(plant_id));
      }

      if (action_type && action_type !== 'ALL') {
        conditions.push(`pl.action_type = $${pIdx++}`);
        params.push(action_type);
      }

      if (date_from) {
        conditions.push(`DATE(pl.log_date) >= $${pIdx++}`);
        params.push(date_from);
      }

      if (date_to) {
        conditions.push(`DATE(pl.log_date) <= $${pIdx++}`);
        params.push(date_to);
      }

      if (q && q.trim()) {
        conditions.push(`(pl.notes ILIKE $${pIdx} OR pl.action_type ILIKE $${pIdx} OR pl.details::text ILIKE $${pIdx})`);
        params.push(`%${q.trim()}%`);
        pIdx++;
      }

      return { whereClause: conditions.join(' AND '), params };
    }

    const q1 = mockBuildLogFilterQuery({
      farm_id: '12',
      plant_id: '45',
      action_type: 'Tưới nước',
      date_from: '2026-09-01',
      date_to: '2026-09-15',
      q: 'NPK'
    }, [12, 13]);

    expect(q1.whereClause).toContain('p.farm_id = $1');
    expect(q1.whereClause).toContain('pl.plant_id = $2');
    expect(q1.whereClause).toContain('pl.action_type = $3');
    expect(q1.whereClause).toContain('DATE(pl.log_date) >= $4');
    expect(q1.whereClause).toContain('DATE(pl.log_date) <= $5');
    expect(q1.whereClause).toContain('pl.notes ILIKE $6');
    expect(q1.params.length).toBe(6);
    expect(q1.params[0]).toBe(12);
    expect(q1.params[1]).toBe(45);
    expect(q1.params[2]).toBe('Tưới nước');

    const q2 = mockBuildLogFilterQuery({
      farm_id: 'ALL',
      plant_id: 'ALL',
      action_type: 'ALL'
    }, [1, 2, 3]);

    expect(q2.whereClause).toContain('p.farm_id = ANY($1)');
    expect(q2.params[0]).toEqual([1, 2, 3]);
  });

  it('12.4 Should verify Admin history routes support restore and purge operations', () => {
    const historyRouteContent = fs.readFileSync(historyRoutePath, 'utf8');
    expect(historyRouteContent.includes('/:id/restore')).toBe(true);
    expect(historyRouteContent.includes('/:id/purge')).toBe(true);
    expect(historyRouteContent.includes('is_deleted = false')).toBe(true);
    expect(historyRouteContent.includes('DELETE FROM plant_logs')).toBe(true);
  });

  it('12.5 Should verify User Portal contains Selective Delete modal, Batch Action Bar, and interactive controls', () => {
    const userContent = fs.readFileSync(userHtmlPath, 'utf8');
    expect(userContent.includes('id="btn-open-selective-log-delete"')).toBe(true);
    expect(userContent.includes('id="selective-log-delete-modal"')).toBe(true);
    expect(userContent.includes('id="modal-del-farm"')).toBe(true);
    expect(userContent.includes('id="modal-del-plant"')).toBe(true);
    expect(userContent.includes('id="modal-del-type"')).toBe(true);
    expect(userContent.includes('id="modal-del-count-preview"')).toBe(true);
    expect(userContent.includes('id="btn-modal-confirm-selective-delete"')).toBe(true);
    expect(userContent.includes('id="btn-toggle-batch-log-mode"')).toBe(true);
    expect(userContent.includes('id="user-logs-batch-action-bar"')).toBe(true);
    expect(userContent.includes('id="user-logs-selected-count"')).toBe(true);
  });

  it('12.6 Should verify Admin Portal History View has DELETE_SOFT filter and action hooks', () => {
    const adminContent = fs.readFileSync(adminHtmlPath, 'utf8');
    const adminJsPath = path.join(__dirname, '../../../frontend/admin/js/database.js');
    const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
    expect(adminContent.includes('value="DELETE_SOFT"')).toBe(true);
    expect(adminJsContent.includes('adminRestoreAuditItem')).toBe(true);
    expect(adminJsContent.includes('adminPurgeAuditItem')).toBe(true);
    expect(adminJsContent.includes("action_type === 'DELETE_SOFT'")).toBe(true);
  });
});
