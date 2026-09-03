import { describe, it, expect } from 'vitest';
import {
  addMonthsToDate,
  getAnchorDateForTargetMonth,
  addMonthsPreservingAnchor,
  computeNextPaymentDate,
  calculateDaysUntilPayment,
  getPaymentStatusColor,
} from '../utils/paymentCalculations';

describe('paymentCalculations', () => {
  describe('getAnchorDateForTargetMonth', () => {
    it('returns exact anchor day when month has enough days', () => {
      expect(getAnchorDateForTargetMonth(15, 2026, 8)).toBe('2026-08-15');
      expect(getAnchorDateForTargetMonth(31, 2026, 8)).toBe('2026-08-31');
      expect(getAnchorDateForTargetMonth(31, 2026, 10)).toBe('2026-10-31');
    });

    it('clamps to last day of month when month has fewer days (30 days)', () => {
      expect(getAnchorDateForTargetMonth(31, 2026, 9)).toBe('2026-09-30');
      expect(getAnchorDateForTargetMonth(31, 2026, 11)).toBe('2026-11-30');
      expect(getAnchorDateForTargetMonth(31, 2026, 4)).toBe('2026-04-30');
      expect(getAnchorDateForTargetMonth(31, 2026, 6)).toBe('2026-06-30');
    });

    it('clamps to last day of February (non-leap and leap year)', () => {
      expect(getAnchorDateForTargetMonth(31, 2026, 2)).toBe('2026-02-28');
      expect(getAnchorDateForTargetMonth(29, 2026, 2)).toBe('2026-02-28');
      expect(getAnchorDateForTargetMonth(31, 2024, 2)).toBe('2024-02-29');
      expect(getAnchorDateForTargetMonth(29, 2024, 2)).toBe('2024-02-29');
    });
  });

  describe('addMonthsPreservingAnchor', () => {
    it('preserves anchor day 31 across months of varying lengths', () => {
      // Aug 31 -> Sep 30 -> Oct 31 -> Nov 30 -> Dec 31
      expect(addMonthsPreservingAnchor('2026-08-31', 1, 31)).toBe('2026-09-30');
      expect(addMonthsPreservingAnchor('2026-08-31', 2, 31)).toBe('2026-10-31');
      expect(addMonthsPreservingAnchor('2026-08-31', 3, 31)).toBe('2026-11-30');
      expect(addMonthsPreservingAnchor('2026-08-31', 4, 31)).toBe('2026-12-31');
      expect(addMonthsPreservingAnchor('2026-08-31', 5, 31)).toBe('2027-01-31');
      expect(addMonthsPreservingAnchor('2026-08-31', 6, 31)).toBe('2027-02-28');
    });

    it('handles year boundary transitions', () => {
      expect(addMonthsPreservingAnchor('2025-11-15', 2, 15)).toBe('2026-01-15');
      expect(addMonthsPreservingAnchor('2025-12-10', 1, 10)).toBe('2026-01-10');
    });
  });

  describe('computeNextPaymentDate', () => {
    const planPrice = 30;

    it('returns join_date + 1 month when no payments exist', () => {
      expect(computeNextPaymentDate('2026-08-31', [], planPrice)).toBe('2026-09-30');
      expect(computeNextPaymentDate('2026-01-15', null, planPrice)).toBe('2026-02-15');
    });

    it('handles core bug: Aug 31 join date, paid slightly late on Sep 02 -> due Sep 30 (not Oct 31)', () => {
      const payments = [
        { id: '1', payment_date: '2026-09-02', amount_usd: 30 }
      ];
      const nextDate = computeNextPaymentDate('2026-08-31', payments, planPrice);
      expect(nextDate).toBe('2026-09-30');
    });

    it('handles next punctual payment on Sep 30 -> due Oct 31', () => {
      const payments = [
        { id: '1', payment_date: '2026-09-02', amount_usd: 30 },
        { id: '2', payment_date: '2026-09-30', amount_usd: 30 }
      ];
      const nextDate = computeNextPaymentDate('2026-08-31', payments, planPrice);
      expect(nextDate).toBe('2026-10-31');
    });

    it('handles multiple prepaid cycles at once ($90 paid for $30/mo plan)', () => {
      const payments = [
        { id: '1', payment_date: '2026-08-31', amount_usd: 90 }
      ];
      const nextDate = computeNextPaymentDate('2026-08-31', payments, planPrice);
      expect(nextDate).toBe('2026-11-30');
    });

    it('handles partial payments accumulating into a full cycle', () => {
      // First partial payment of $15 -> still due first target (Sep 30)
      const payments1 = [
        { id: '1', payment_date: '2026-08-31', amount_usd: 15 }
      ];
      expect(computeNextPaymentDate('2026-08-31', payments1, planPrice)).toBe('2026-09-30');

      // Second partial payment of $15 completes 1 cycle -> due Sep 30
      const payments2 = [
        { id: '1', payment_date: '2026-08-31', amount_usd: 15 },
        { id: '2', payment_date: '2026-09-10', amount_usd: 15 }
      ];
      expect(computeNextPaymentDate('2026-08-31', payments2, planPrice)).toBe('2026-09-30');

      // Third payment of $30 completes 2nd cycle -> due Oct 31
      const payments3 = [
        ...payments2,
        { id: '3', payment_date: '2026-09-30', amount_usd: 30 }
      ];
      expect(computeNextPaymentDate('2026-08-31', payments3, planPrice)).toBe('2026-10-31');
    });

    it('handles returning inactive clients with attendance gaps (Judelis case)', () => {
      // Client joined Jan 29, paid intermittently, stopped in July, returned Sep 03
      const payments = [
        { id: '1', payment_date: '2026-01-29', amount_usd: 30 }, // -> Feb 28
        { id: '2', payment_date: '2026-03-05', amount_usd: 30 }, // -> Mar 29
        { id: '3', payment_date: '2026-05-10', amount_usd: 30 }, // -> May 29
        { id: '4', payment_date: '2026-06-29', amount_usd: 30 }, // -> Jul 29
        // Gap: Absent during August. Returns on Sep 03 and pays $30:
        { id: '5', payment_date: '2026-09-03', amount_usd: 30 }
      ];
      const nextDate = computeNextPaymentDate('2026-01-29', payments, planPrice);
      // Sep 03 <= Sep 29 -> reactivated for September coverage, due Sep 29
      expect(nextDate).toBe('2026-09-29');
    });

    it('handles payment on anchor day itself', () => {
      const payments = [
        { id: '1', payment_date: '2026-01-15', amount_usd: 30 },
        { id: '2', payment_date: '2026-02-15', amount_usd: 30 }
      ];
      expect(computeNextPaymentDate('2026-01-15', payments, planPrice)).toBe('2026-03-15');
    });
  });

  describe('calculateDaysUntilPayment and getPaymentStatusColor', () => {
    it('returns negative days and red color for overdue payments', () => {
      const days = calculateDaysUntilPayment('2020-01-01');
      expect(days).toBeLessThan(0);
      expect(getPaymentStatusColor(days)).toBe('text-red-500');
    });

    it('returns green color for active payments far in future', () => {
      const days = calculateDaysUntilPayment('2099-01-01');
      expect(days).toBeGreaterThan(15);
      expect(getPaymentStatusColor(days)).toBe('text-green-500');
    });
  });
});
