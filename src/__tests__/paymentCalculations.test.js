import { describe, it, expect } from 'vitest';
import {
  addMonthsToDate,
  addMonthsPreservingAnchor,
  getAnchorDateForTargetMonth,
  computeNextPaymentDate,
  calculateDaysUntilPayment,
  getPaymentStatusColor,
} from '../utils/paymentCalculations';

describe('paymentCalculations - addMonthsPreservingAnchor & getAnchorDateForTargetMonth', () => {
  it('obtiene la fecha correcta para un mes y ancla dados', () => {
    expect(getAnchorDateForTargetMonth(31, 2026, 8)).toBe('2026-08-31');
    expect(getAnchorDateForTargetMonth(31, 2026, 9)).toBe('2026-09-30'); // Septiembre tiene 30 días
    expect(getAnchorDateForTargetMonth(31, 2026, 2)).toBe('2026-02-28'); // Febrero no bisiesto
    expect(getAnchorDateForTargetMonth(31, 2024, 2)).toBe('2024-02-29'); // Febrero bisiesto
    expect(getAnchorDateForTargetMonth(29, 2026, 9)).toBe('2026-09-29');
  });

  it('agrega meses preservando el día ancla en saltos sucesivos', () => {
    expect(addMonthsPreservingAnchor('2026-08-31', 1, 31)).toBe('2026-09-30');
    expect(addMonthsPreservingAnchor('2026-08-31', 2, 31)).toBe('2026-10-31');
    expect(addMonthsPreservingAnchor('2026-08-31', 3, 31)).toBe('2026-11-30');
    expect(addMonthsPreservingAnchor('2026-08-31', 6, 31)).toBe('2027-02-28');
    expect(addMonthsPreservingAnchor('2026-08-31', 7, 31)).toBe('2027-03-31');
  });
});

describe('paymentCalculations - addMonthsToDate', () => {
  it('agrega 1 mes correctamente a fechas estándar', () => {
    expect(addMonthsToDate('2026-05-15', 1)).toBe('2026-06-15');
    expect(addMonthsToDate('2026-01-10', 3)).toBe('2026-04-10');
  });

  it('maneja el caso de fin de mes: 31 de agosto + 1 mes = 30 de septiembre', () => {
    expect(addMonthsToDate('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('preserva el ancla del día 31 al sumar 2 meses desde agosto (31 de octubre)', () => {
    expect(addMonthsToDate('2026-08-31', 2)).toBe('2026-10-31');
  });

  it('ajusta correctamente a 28 de febrero en año no bisiesto', () => {
    expect(addMonthsToDate('2027-01-31', 1)).toBe('2027-02-28');
  });

  it('ajusta correctamente a 29 de febrero en año bisiesto', () => {
    expect(addMonthsToDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToDate('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('retorna null para entradas inválidas', () => {
    expect(addMonthsToDate(null, 1)).toBeNull();
    expect(addMonthsToDate('', 1)).toBeNull();
    expect(addMonthsToDate('2026-08-31', -1)).toBeNull();
  });
});

describe('paymentCalculations - computeNextPaymentDate', () => {
  const planPrice = 30;

  it('caso reportado 1 (Cesar Vicent): ingreso 31 de agosto, pago tardío el 02 de septiembre -> vence 30 de septiembre', () => {
    const joinDate = '2026-08-31';
    const payments = [
      { id: '1', amount_usd: 30, payment_date: '2026-09-02' }
    ];

    const nextDate = computeNextPaymentDate(joinDate, payments, planPrice);
    // Debe cubrir el ciclo de septiembre hasta su día ancla: 30 de septiembre
    expect(nextDate).toBe('2026-09-30');
  });

  it('caso reportado 2 (Judelis Fernandez): ingreso 29 de enero, pagos con meses inactivos en el medio, pago reciente el 03 de septiembre -> vence 29 de septiembre', () => {
    const joinDate = '2026-01-29';
    // Pagó enero, marzo, mayo, junio, julio... y luego reactiva pagando el 3 de septiembre
    const payments = [
      { id: '1', amount_usd: 30, payment_date: '2026-01-29' },
      { id: '2', amount_usd: 30, payment_date: '2026-03-01' },
      { id: '3', amount_usd: 30, payment_date: '2026-05-02' },
      { id: '4', amount_usd: 30, payment_date: '2026-06-03' },
      { id: '5', amount_usd: 30, payment_date: '2026-07-04' },
      { id: '6', amount_usd: 30, payment_date: '2026-09-03' },
    ];

    const nextDate = computeNextPaymentDate(joinDate, payments, planPrice);
    // El pago del 03 de septiembre debe reactivar su membresía para el mes corriente con vencimiento el 29 de septiembre
    expect(nextDate).toBe('2026-09-29');
  });

  it('si el cliente reactiva después de su día ancla en el mes, vence el mes siguiente (ej: ancla 15, paga 20 Sep -> vence 15 Oct)', () => {
    const joinDate = '2026-01-15';
    const payments = [
      { id: '1', amount_usd: 30, payment_date: '2026-01-15' },
      // Estuvo inactivo meses y regresa pagando el 20 de septiembre
      { id: '2', amount_usd: 30, payment_date: '2026-09-20' },
    ];

    const nextDate = computeNextPaymentDate(joinDate, payments, planPrice);
    expect(nextDate).toBe('2026-10-15');
  });

  it('renovaciones continuas y puntuales extienden la fecha secuencialmente', () => {
    const joinDate = '2026-01-15';
    const payments = [
      { id: '1', amount_usd: 30, payment_date: '2026-01-15' }, // vence 2026-02-15
      { id: '2', amount_usd: 30, payment_date: '2026-02-14' }, // vence 2026-03-15
      { id: '3', amount_usd: 30, payment_date: '2026-03-15' }, // vence 2026-04-15
    ];

    const nextDate = computeNextPaymentDate(joinDate, payments, planPrice);
    expect(nextDate).toBe('2026-04-15');
  });

  it('si no hay pagos registrados, proyecta el primer vencimiento a 1 mes del ingreso', () => {
    const joinDate = '2026-08-31';
    const nextDate = computeNextPaymentDate(joinDate, [], planPrice);
    expect(nextDate).toBe('2026-09-30');
  });

  it('maneja pagos adelantados de múltiples meses (ej: 3 meses = $90)', () => {
    const joinDate = '2026-08-31';
    const payments = [
      { id: '1', amount_usd: 90, payment_date: '2026-08-31' }
    ];

    const nextDate = computeNextPaymentDate(joinDate, payments, planPrice);
    expect(nextDate).toBe('2026-11-30');
  });

  it('maneja pagos parciales acumulativos', () => {
    const joinDate = '2026-08-31';

    // Pago 1: $15 (incompleto, 0 ciclos)
    const partialPayment1 = [
      { id: '1', amount_usd: 15, payment_date: '2026-09-01' }
    ];
    expect(computeNextPaymentDate(joinDate, partialPayment1, planPrice)).toBe('2026-09-30');

    // Pago 2: otro $15 (completa $30 = 1 ciclo)
    const fullPayment1 = [
      { id: '1', amount_usd: 15, payment_date: '2026-09-01' },
      { id: '2', amount_usd: 15, payment_date: '2026-09-05' }
    ];
    expect(computeNextPaymentDate(joinDate, fullPayment1, planPrice)).toBe('2026-09-30');

    // Pago 3: otro $30 (completa $60 = 2 ciclos)
    const fullPayment2 = [
      ...fullPayment1,
      { id: '3', amount_usd: 30, payment_date: '2026-09-29' }
    ];
    expect(computeNextPaymentDate(joinDate, fullPayment2, planPrice)).toBe('2026-10-31');
  });

  it('retorna null para parámetros inválidos', () => {
    expect(computeNextPaymentDate(null, [], 30)).toBeNull();
    expect(computeNextPaymentDate('2026-08-31', [], 0)).toBeNull();
    expect(computeNextPaymentDate('2026-08-31', [], -10)).toBeNull();
  });
});

describe('paymentCalculations - calculateDaysUntilPayment & getPaymentStatusColor', () => {
  it('calcula correctamente los días de diferencia', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    expect(calculateDaysUntilPayment(todayStr)).toBe(0);
    expect(getPaymentStatusColor(0)).toBe('text-yellow-500');

    // Días negativos (vencido)
    expect(getPaymentStatusColor(-5)).toBe('text-red-500');

    // Días próximos a vencer (1-7 días)
    expect(getPaymentStatusColor(5)).toBe('text-orange-500');

    // Días activos (>15 días)
    expect(getPaymentStatusColor(20)).toBe('text-green-500');
  });
});
