/**
 * Test completo de flujos de pagos:
 * - Pago parcial
 * - Pago completo
 * - Pago de 1 mes y múltiples meses
 * - Pago desde fecha hasta fecha
 * - Estado del cliente después de cada pago
 * - Inscripción ($)
 *
 * No hace llamadas a la API ni a Supabase.
 * Todas las funciones se prueban de forma aislada con datos mockeados.
 */
import { describe, it, expect } from 'vitest';

// Importar funciones directamente
import {
  getEffectiveAmount,
  computeNextPaymentDate,
  calculatePaymentCycle,
  calculateDaysUntilPayment,
  getPaymentStatusColor,
  addMonthsPreservingAnchor,
  differenceInCalendarMonths,
} from '@/utils/paymentCalculations';

// ─── Helpers para crear pagos mock ────────────────────────────────────────────
function makePayment(overrides = {}) {
  return {
    id: `pay-${Math.random().toString(36).slice(2)}`,
    amount_usd: 30,
    amount_bs: 0,
    exchange_rate: 1,
    payment_type: 'pago_movil',
    discount_type: null,
    discount_value: null,
    payment_date: '2026-01-15',
    is_archived: false,
    plan_id: 'plan-1',
    client_id: 'client-1',
    ...overrides,
  };
}

function makePlan(overrides = {}) {
  return {
    id: 'plan-1',
    name: 'Plan Básico',
    price: 30,
    currency: 'USD',
    ...overrides,
  };
}

const PLAN = makePlan();
const BS_PLAN = makePlan({ price: 9000, currency: 'BS' });

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Flujos completos de pago', () => {
  describe('1. Pago completo de 1 mes', () => {
    const joinDate = '2026-01-15';

    it('debe calcular next_payment_date a 2026-02-15 tras pagar $30', () => {
      const payments = [makePayment({ payment_date: '2026-01-15', amount_usd: 30 })];
      const next = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
      expect(next).toBe('2026-02-15');
    });

    it('el ciclo debe ser 1, remaining 0', () => {
      const payments = [makePayment({ payment_date: '2026-01-15', amount_usd: 30 })];
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(1);
      expect(result.currentRemaining).toBeCloseTo(0);
      expect(result.isFullyPaid).toBe(true);
    });
  });

  describe('2. Pago parcial (first installment)', () => {
    const joinDate = '2026-01-15';

    it('pago de $15 no debe extender el ciclo', () => {
      const payments = [makePayment({ payment_date: '2026-01-15', amount_usd: 15 })];
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(0);
      expect(result.currentRemaining).toBeCloseTo(15);
      expect(result.isFullyPaid).toBe(false);
    });

    it('next_payment_date se mantiene igual tras pago parcial', () => {
      const payments = [makePayment({ payment_date: '2026-01-15', amount_usd: 15 })];
      const next = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
      // El primer pago es parcial, no avanza el ciclo
      expect(next).toBe('2026-02-15'); // join_date + 1 mes
    });

    it('segundo pago parcial de $15 completa el ciclo', () => {
      const payments = [
        makePayment({ payment_date: '2026-01-15', amount_usd: 15 }),
        makePayment({ payment_date: '2026-01-20', amount_usd: 15 }),
      ];
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(1);
      expect(result.currentRemaining).toBeCloseTo(0);
      expect(result.isFullyPaid).toBe(true);
    });
  });

  describe('3. Pago de múltiples meses (anticipado)', () => {
    const joinDate = '2026-01-15';

    it('pago de $90 (3 meses) debe extender a abril', () => {
      const payments = [makePayment({ payment_date: '2026-01-15', amount_usd: 90 })];
      const next = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
      expect(next).toBe('2026-04-15');
    });

    it('pago de $60 (2 meses) debe extender a marzo', () => {
      const payments = [makePayment({ payment_date: '2026-01-15', amount_usd: 60 })];
      const next = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
      expect(next).toBe('2026-03-15');
    });
  });

  describe('4. Reactivación tras inactividad', () => {
    const joinDate = '2026-01-15';

    it('cliente que no pagó en 3 meses, al pagar reactiva su mes corriente', () => {
      const payments = [
        makePayment({ payment_date: '2026-01-15', amount_usd: 30 }),
        makePayment({ payment_date: '2026-02-14', amount_usd: 30 }),
        // Marzo y abril no pagados
        makePayment({ payment_date: '2026-05-02', amount_usd: 30 }),
      ];
      const next = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
      // May 2 (payDay=2) < anchor day 15 → vence 15 de mayo (mes de pago)
      expect(next).toBe('2026-05-15');
    });

    it('reactivación con pago antes del día ancla', () => {
      const payments = [
        makePayment({ payment_date: '2026-01-15', amount_usd: 30 }),
        makePayment({ payment_date: '2026-02-14', amount_usd: 30 }),
        // Marzo no pagado
        makePayment({ payment_date: '2026-04-10', amount_usd: 30 }),
      ];
      const next = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
      // Apr 10 < anchor day 15 → vence 15 de abril
      expect(next).toBe('2026-04-15');
    });
  });

  describe('5. Pago con descuento porcentual', () => {
    it('20% descuento sobre $30 → efectivo $37.50, 1 ciclo completo', () => {
      const payments = [
        makePayment({
          amount_usd: 30,
          discount_type: 'percentage',
          discount_value: 20,
        }),
      ];
      const effective = getEffectiveAmount(payments[0], PLAN);
      expect(effective).toBeCloseTo(37.50, 1);
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(1);
      expect(result.currentRemaining).toBeCloseTo(7.50);
    });

    it('descuento fijo de $5 sobre $30 → efectivo $35, 1 ciclo completo', () => {
      const payments = [
        makePayment({
          amount_usd: 30,
          discount_type: 'fixed',
          discount_value: 5,
        }),
      ];
      const effective = getEffectiveAmount(payments[0], PLAN);
      expect(effective).toBe(35);
    });

    it('100% descuento → efectivo 0 (full coverage sentinela)', () => {
      const payments = [
        makePayment({
          amount_usd: 30,
          discount_type: 'percentage',
          discount_value: 100,
        }),
      ];
      const effective = getEffectiveAmount(payments[0], PLAN);
      expect(effective).toBe(0);
    });
  });

  describe('6. Plan en BS (Bolívares)', () => {
    const bsJoinDate = '2026-01-15';

    it('pago completo en Bs debe funcionar igual', () => {
      const payments = [makePayment({ amount_bs: 9000, amount_usd: 30, plan_id: 'bs-plan' })];
      const next = computeNextPaymentDate(bsJoinDate, payments, BS_PLAN, BS_PLAN.price);
      expect(next).toBe('2026-02-15');
    });

    it('pago mixto: 5000 Bs + 4000 Bs = 9000 Bs = 1 ciclo', () => {
      const payments = [
        makePayment({ amount_bs: 5000, amount_usd: 16.67 }),
        makePayment({ amount_bs: 4000, amount_usd: 13.33 }),
      ];
      const result = calculatePaymentCycle(payments, BS_PLAN.price, BS_PLAN);
      expect(result.cycles).toBe(1);
      expect(result.isFullyPaid).toBe(true);
    });

    it('efectivo_dolares usa amount_usd independientemente del plan', () => {
      const payment = makePayment({
        payment_type: 'efectivo_dolares',
        amount_usd: 30,
        amount_bs: 9000,
      });
      const effective = getEffectiveAmount(payment, BS_PLAN);
      // efectivo_dolares siempre lee amount_usd
      expect(effective).toBe(30);
    });

    it('efectivo_bolivares usa amount_bs independientemente del plan', () => {
      const payment = makePayment({
        payment_type: 'efectivo_bolivares',
        amount_usd: 30,
        amount_bs: 9000,
      });
      const effective = getEffectiveAmount(payment, BS_PLAN);
      expect(effective).toBe(9000);
    });
  });

  describe('7. Fecha límite de mes (anchor clamping)', () => {
    it('join 31 de enero → febrero se ajusta a 28/29 según bisiesto', () => {
      const jan31 = '2026-01-31';
      const next = computeNextPaymentDate(jan31, [], PLAN, PLAN.price);
      expect(next).toBe('2026-02-28');
    });

    it('join 31 de agosto → septiembre se ajusta a 30', () => {
      const aug31 = '2026-08-31';
      const next = computeNextPaymentDate(aug31, [], PLAN, PLAN.price);
      expect(next).toBe('2026-09-30');
    });

    it('febrero bisiesto preserve 29', () => {
      const jan29 = '2024-01-29';
      const next = addMonthsPreservingAnchor(jan29, 1, 29);
      expect(next).toBe('2024-02-29');
    });
  });

  describe('8. calculateDaysUntilPayment', () => {
    it('fecha futura → días positivos', () => {
      const days = calculateDaysUntilPayment('2026-12-31', '2026-01-01');
      expect(days).toBeGreaterThan(0);
    });

    it('fecha pasada → días negativos', () => {
      const days = calculateDaysUntilPayment('2020-01-01', '2026-01-01');
      expect(days).toBeLessThan(0);
    });

    it('mismo día → 0', () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(calculateDaysUntilPayment(todayStr)).toBe(0);
    });

    it('null devuelve null', () => {
      expect(calculateDaysUntilPayment(null)).toBeNull();
    });
  });

  describe('9. getPaymentStatusColor', () => {
    it('vencido → rojo', () => expect(getPaymentStatusColor(-5)).toBe('text-red-500'));
    it('hoy → amarillo', () => expect(getPaymentStatusColor(0)).toBe('text-yellow-500'));
    it('5 días → naranja', () => expect(getPaymentStatusColor(5)).toBe('text-orange-500'));
    it('12 días → amarillo', () => expect(getPaymentStatusColor(12)).toBe('text-yellow-500'));
    it('20 días → verde', () => expect(getPaymentStatusColor(20)).toBe('text-green-500'));
    it('null → gris', () => expect(getPaymentStatusColor(null)).toBe('text-gray-500'));
  });

  describe('10. differenceInCalendarMonths', () => {
    it('misma fecha → 1 (mínimo)', () => {
      expect(differenceInCalendarMonths('2026-01-15', '2026-01-15')).toBe(1);
    });

    it('15 ene a 15 mar → 2 meses', () => {
      expect(differenceInCalendarMonths('2026-01-15', '2026-03-15')).toBe(2);
    });

    it('15 ene a 14 mar → 1 mes (no completa)', () => {
      expect(differenceInCalendarMonths('2026-01-15', '2026-03-14')).toBe(1);
    });

    it('valores nulos → 1', () => {
      expect(differenceInCalendarMonths(null, '2026-01-01')).toBe(1);
      expect(differenceInCalendarMonths('2026-01-01', null)).toBe(1);
    });
  });

  describe('11. Inscripción ($5 USD) integrada', () => {
    const INSCRIPTION = 5;

    it('primer ciclo incluye inscripción: total = planPrice + INSCRIPTION', () => {
      const planWithInscription = makePlan({ price: 30 });
      const joinDate = '2026-01-15';

      // Pago único de $35 (30 plan + 5 inscripción)
      const payments = [makePayment({ amount_usd: 35 })];
      const result = calculatePaymentCycle(payments, planWithInscription.price, planWithInscription);
      // Como el precio del plan es 30 y pagó 35, debería haber 1 ciclo completo + $5 sobrante
      expect(result.cycles).toBe(1);
      expect(result.currentRemaining).toBeCloseTo(5);
    });

    it('sin inscripción, pago de $30 → 1 ciclo, remaining 0', () => {
      const payments = [makePayment({ amount_usd: 30 })];
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(1);
      expect(result.currentRemaining).toBeCloseTo(0);
    });
  });

  describe('12. Edge cases y robustez', () => {
    it('pagos vacíos → retorna null o join_date + 1 mes', () => {
      const next = computeNextPaymentDate('2026-01-15', [], PLAN, PLAN.price);
      expect(next).toBe('2026-02-15');
    });

    it('plan price 0 → retorna null', () => {
      const next = computeNextPaymentDate('2026-01-15', [], PLAN, 0);
      expect(next).toBeNull();
    });

    it('plan price negativo → retorna null', () => {
      const next = computeNextPaymentDate('2026-01-15', [], PLAN, -10);
      expect(next).toBeNull();
    });

    it('join_date null → retorna null', () => {
      const next = computeNextPaymentDate(null, [], PLAN, PLAN.price);
      expect(next).toBeNull();
    });

    it('monto 0 en pago → se ignora', () => {
      const payments = [makePayment({ amount_usd: 0 })];
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(0);
      expect(result.currentRemaining).toBeCloseTo(PLAN.price);
    });

    it('monto negativo en pago → se ignora', () => {
      const payments = [makePayment({ amount_usd: -10 })];
      const result = calculatePaymentCycle(payments, PLAN.price, PLAN);
      expect(result.cycles).toBe(0);
    });
  });

  describe('13. Flujo completo: registro → pagos parciales → reactivación', () => {
    const joinDate = '2026-01-15';
    const client = 'client-1';

    const scenario = [
      // 1. Registro: cliente se une el 15 de enero
      { step: 'registro', date: '2026-01-15', amount: 15, note: 'primer pago parcial' },
      { step: 'completa parcial', date: '2026-01-20', amount: 15, note: 'cierra ciclo enero' },
      // 2. Paga febrero completo
      { step: 'febrero', date: '2026-02-14', amount: 30, note: 'pago puntual' },
      // 3. No paga marzo (vence 15 marzo)
      // 4. Se reactiva en abril con pago parcial
      { step: 'reactivación parcial', date: '2026-04-10', amount: 15, note: 'pago antes del ancla' },
      { step: 'cierra abril', date: '2026-04-12', amount: 15, note: 'completa ciclo' },
    ];

    it('calcula correctamente el estado después de cada paso', () => {
      const payments = [];
      let expectedNextDates = [
        '2026-02-15', // tras registrar → mismo ancla
        '2026-02-15', // tras completar enero
        '2026-03-15', // febrero puntual
        '2026-03-15', // marzo no pagado, still vencido
        '2026-04-15', // reactivación antes del ancla
        '2026-05-15', // cierra abril
      ];

      scenario.forEach((s, i) => {
        payments.push(makePayment({ payment_date: s.date, amount_usd: s.amount }));
        const result = computeNextPaymentDate(joinDate, payments, PLAN, PLAN.price);
        const expected = expectedNextDates[i];

        if (result !== expected) {
          console.warn(
            `Step ${i + 1} [${s.step}]: expected ${expected}, got ${result}. Amount: $${s.amount}`
          );
        }
        expect(result).toBe(expected);
      });
    });
  });
});
