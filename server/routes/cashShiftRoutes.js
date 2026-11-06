const express = require('express');
const cashShiftService = require('../cashShiftService');
const aldeloService = require('../aldeloService');
const auditService = require('../auditService');
const { requireRole } = require('../middleware/auth');
const { validateShiftOpenPayload } = require('../middleware/validate');

function createCashShiftRoutes(io) {
  const router = express.Router();

  router.get('/current', (req, res) => {
    try {
      const current = cashShiftService.getCurrentShift();
      res.json({ success: true, data: current });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/open', requireRole('cashier', 'admin'), validateShiftOpenPayload, async (req, res) => {
    try {
      const { cashierId, cashierName, initialCash, notes } = req.body;
      const shift = cashShiftService.openShift({ cashierId, cashierName, initialCash, notes });
      aldeloService
        .signInCashier({ employeeId: cashierId, startAmount: initialCash })
        .catch((e) => console.warn('[Aldelo SignInCashier]', e.message));

      auditService.record({
        action: 'SHIFT_OPEN',
        actor: (req.user && req.user.name) || cashierName || cashierId || 'cashier',
        target: shift.id,
        details: { shiftNumber: shift.shiftNumber, initialCash: shift.initialCash }
      });

      if (io) io.emit('cashier:shift_opened', shift);
      res.status(201).json({ success: true, data: shift });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/close', requireRole('cashier', 'admin'), async (req, res) => {
    try {
      const actualCash =
        req.body.actualCashInDrawer !== undefined ? req.body.actualCashInDrawer : req.body.actualCash;
      const closedBy =
        req.body.closedBy || req.body.cashierName || (req.user && req.user.name) || 'Cajero';
      const notes = req.body.notes || '';
      const shift = cashShiftService.closeShift({
        actualCashInDrawer: actualCash,
        closedBy,
        notes
      });

      aldeloService
        .signOutCashier({
          endAmount: actualCash,
          discrepancy: shift.closing?.difference,
          notes
        })
        .catch((e) => console.warn('[Aldelo SignOutCashier]', e.message));

      auditService.record({
        action: 'SHIFT_CLOSE',
        actor: closedBy,
        target: shift.id,
        details: {
          shiftNumber: shift.shiftNumber,
          expectedCash: shift.closing?.expectedCashInDrawer,
          actualCash: shift.closing?.actualCashInDrawer,
          difference: shift.closing?.difference,
          statusDifference: shift.closing?.statusDifference
        }
      });

      if (io) io.emit('cashier:shift_closed', shift);
      res.json({ success: true, data: shift });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/history', requireRole('cashier', 'admin'), (req, res) => {
    try {
      const history = cashShiftService.getHistory();
      res.json({ success: true, data: history });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createCashShiftRoutes };
