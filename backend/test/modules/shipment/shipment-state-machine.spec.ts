import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionShipment } from '../../../src/modules/shipment/domain/shipment-state-machine.ts';
import type { ShipmentStatus } from '../../../src/modules/shipment/domain/types.ts';

test('[RB-MG12] Shipment follows the five documented edges and preserves its input', () => {
  const states = ['PENDING', 'HANDED_OVER', 'SHIPPING', 'DELIVERED', 'FAILED'] as const;
  const allowed = new Set(['PENDING:HANDED_OVER', 'HANDED_OVER:SHIPPING', 'HANDED_OVER:FAILED', 'SHIPPING:DELIVERED', 'SHIPPING:FAILED']);
  for (const from of states) {
    for (const to of states) {
      const shipment = Object.freeze({ status: from });
      const result = transitionShipment(shipment, to);
      if (allowed.has(`${from}:${to}`)) {
        assert.deepEqual(result, { allowed: true, from, to });
      } else {
        assert.deepEqual(result, { allowed: false, reason: 'INVALID_TRANSITION' });
      }
      assert.equal(shipment.status, from);
    }
  }
});

test('[RB-MG12] Unknown Shipment statuses produce a domain rejection', () => {
  for (const invalid of ['UNKNOWN', 'toString', '', null]) {
    assert.deepEqual(transitionShipment({ status: invalid as ShipmentStatus }, 'SHIPPING'), { allowed: false, reason: 'INVALID_STATUS' });
    assert.deepEqual(transitionShipment({ status: 'PENDING' }, invalid as ShipmentStatus), { allowed: false, reason: 'INVALID_STATUS' });
  }
});
