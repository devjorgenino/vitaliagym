/**
 * Utilities for calculating next payment dates
 *
 * SYSTEM LOGIC (Chronological Lifecycle with Day Anchor):
 * - The cutoff DAY always anchors to the join_date (e.g., day 29 if joined on the 29th, day 31 if joined on the 31st).
 * - Chronological payment processing:
 *   1. If payment is made within active validity (payment_date <= currentDueDate),
 *      extends coverage by N cycles from the current due date (on-time/early renewal).
 *   2. If payment is made after an inactivity period (payment_date > currentDueDate),
 *      reactivates membership covering the current month according to its anchor day:
 *      - If payDay <= anchorDay: expires on the anchor day of the payment month (e.g., paid Sep 3 with anchor 29 -> expires Sep 29).
 *      - If payDay > anchorDay: expires on the anchor day of the following month (e.g., paid Sep 30 with anchor 29 -> expires Oct 29).
 *   3. If payment is maintenance, it is treated as a full coverage cycle.
 *   4. Partial payments: accumulate balance until completing the price of 1 cycle before extending the date.
 *   5. No Payments: Projects first due date to 1 month from join_date.
 */
import client from '../api/client';
import { getPlanFrequency } from '@/lib/planUtils';

/**
 * Fixed registration (enrollment) fee in USD.
 * Charged ONLY ONCE when registering a client or doing a clean slate.
 */
export const INSCRIPTION_PRICE = 5;

/**
 * Maximum effective amount in USD.
 * Prevents extreme dates due to anomalous amounts/discounts.
 */
const MAX_EFFECTIVE_AMOUNT_USD = 10000;

/**
 * Maximum effective amount in BS.
 * For bolivar plans, a payment of up to 1M Bs is reasonable.
 */
const MAX_EFFECTIVE_AMOUNT_BS = 1000000;

/**
 * Maximum cycles a single payment can cover (2 years = 24 months).
 */
const MAX_CYCLES_PER_PAYMENT = 24;

/**
 * Constants for client status calculation
 */
const MAX_DAYS_ACTIVE = 30;
const MAX_CYCLES = 12;

/**
 * Calculates how many periods a payment covers based on its effective amount and plan price.
 * For monthly plans: returns months covered
 * For daily/weekly plans: returns days/weeks covered (no accumulation across periods)
 * @param {Object} payment - Payment record
 * @param {Object} plan - Client's plan (for frequency and price)
 * @returns {number} Number of periods covered (minimum 1 if payment is positive)
 */
export function getPeriodsCoveredByPayment(payment, plan) {
  if (!payment || !plan) return 0;

  const planPrice = parseFloat(plan.price) || 0;
  if (planPrice <= 0) return 0;

  const frequency = getPlanFrequency(plan);
  const effective = getEffectiveAmount(payment, plan);

  // For monthly plans, we calculate months covered (existing behavior)
  // For daily/weekly plans, each payment covers exact periods (no accumulation logic needed here)
  // The accumulation logic is handled differently in computeNextPaymentDate for non-monthly plans
  const basePeriods = Math.max(Math.floor(effective / planPrice), 0);

  // For maintenance payments, treat as at least one period if effective > 0
  if (isMaintenancePayment(payment) && effective > 0 && basePeriods === 0) {
    return 1;
  }

  return basePeriods;
}

/**
 * Determines if a payment corresponds to maintenance.
 * Looks for the word "maintenance" (case-insensitive) in the reference field.
 * @param {Object} payment - Payment record
 * @returns {boolean} true if it's a maintenance payment
 */
export function isMaintenancePayment(payment) {
  if (!payment) return false;
  const ref = (payment.reference || '').toLowerCase();
  return ref.includes('maintenance') || ref.includes('maintenance fee') || ref.includes('mantenimiento');
}

/**
 * Calculates the effective amount covered by a payment considering applied discounts.
 * If a client paid $21.25 with a 15% discount on a $25 plan,
 * the effective covered amount is $25.00.
 *
 * @param {Object} payment - Payment record
 * @param {Object} [plan] - Client's plan (optional, to support BS currency)
 * @param {number} [fallbackRate=310] - Default exchange rate for BS->USD conversion
 * @returns {number} - Effective amount in USD (or BS if plan is in BS)
 */
export function getEffectiveAmount(payment, plan, fallbackRate = 310) {
  if (!payment) return 0;
  const field = getPaymentAmountField(payment, plan);
  let amount = parseFloat(payment[field]) || 0;
  const isBSPlan = (plan?.currency || 'USD').toUpperCase() === 'BS';

  // For USD plans with bolivar cash, convert to USD
  if (payment.payment_type === 'efectivo_bolivares' && !isBSPlan) {
    const rate = payment.exchange_rate || fallbackRate;
    amount = amount / rate;
  }

  // Validate base amount reasonableness
  const maxAmount = isBSPlan ? MAX_EFFECTIVE_AMOUNT_BS : MAX_EFFECTIVE_AMOUNT_USD;
  if (amount > maxAmount) {
    console.warn(
      `⚠️ Anomalous amount detected: ${amount} in payment ${payment.id || 'unknown'} (${isBSPlan ? 'Bs' : 'USD'}), limiting to ${maxAmount}`
    );
    amount = maxAmount;
  }

  if (payment.discount_type === 'percentage' && payment.discount_value) {
    const disc = parseFloat(payment.discount_value) || 0;
    if (disc > 0 && disc < 100) {
      // Protection against discounts near 100% that inflate effective amount
      const maxDiscount = 95; // Maximum 95% discount
      const safeDisc = Math.min(disc, maxDiscount);
      if (disc !== safeDisc) {
        console.warn(`⚠️ Excessive discount ${disc}% in payment ${payment.id || 'unknown'}, limiting to ${maxDiscount}%`);
      }
      amount = amount / (1 - safeDisc / 100);
    } else if (disc >= 100) {
      // 100% discount means full coverage - treat as 0 for cycle purposes
      return 0;
    }
  } else if (payment.discount_type === 'fixed' && payment.discount_value) {
    const fixedDisc = parseFloat(payment.discount_value) || 0;
    // Validate fixed discount reasonableness
    if (fixedDisc > MAX_EFFECTIVE_AMOUNT_USD) {
      console.warn(`⚠️ Anomalous fixed discount: ${fixedDisc}, limiting`);
      amount += MAX_EFFECTIVE_AMOUNT_USD;
    } else {
      amount += fixedDisc;
    }
  }

  // Final effective amount limit
  if (amount > maxAmount) {
    amount = maxAmount;
  }

  return Math.round(amount * 100) / 100;
}

/**
 * Determines the amount field to use for payments based on payment method and base plan currency.
 *
 * Rules:
 * - If payment is in US dollars (efectivo_dolares) → use `amount_usd` (dollar amount paid)
 * - If payment is in bolivar cash (efectivo_bolivares) → use `amount_bs` (bolivar amount paid)
 * - If payment is another type → use field based on plan currency:
 *   - USD plan  → `amount_usd`
 *   - BS plan   → `amount_bs`
 *
 * @param {Object} payment - Payment with possible `payment_type` field ('efectivo_dolares' | 'efectivo_bolivares' | ...)
 * @param {Object} plan - Plan with possible `currency` field ('USD' | 'BS')
 * @returns {'amount_usd'|'amount_bs'}
 */
function getPaymentAmountField(payment, plan) {
  // Prioritize payment_type for cash payments
  if (payment?.payment_type === 'efectivo_dolares') {
    return 'amount_usd';
  }
  if (payment?.payment_type === 'efectivo_bolivares') {
    return 'amount_bs';
  }

  // For other payment types, use plan currency
  const currency = (plan?.currency || 'USD').toUpperCase();
  return currency === 'BS' ? 'amount_bs' : 'amount_usd';
}

/**
 * Sums payments in the plan's base currency, applying discounts (effective amount).
 * @param {Array} clientPayments - Client's payments
 * @param {Object} plan - Client's plan
 * @returns {number} Total paid in plan's base currency
 */
export function sumPaymentsInPlanCurrency(clientPayments, plan) {
  if (!clientPayments || clientPayments.length === 0) return 0;
  return clientPayments.reduce((sum, p) => sum + getEffectiveAmount(p, plan), 0);
}

/**
 * Gets YYYY-MM-DD date for a specific year and month respecting the anchor day.
 * If the target month has fewer days than the anchor (e.g., 31 in February or September),
 * it adjusts to the last available day of that month.
 *
 * @param {number} anchorDay - Original client anchor day (1-31)
 * @param {number} year - Target year
 * @param {number} month - Target month (1-12)
 * @returns {string} - Date in YYYY-MM-DD format
 */
export function getAnchorDateForTargetMonth(anchorDay, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(anchorDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Calculates calendar month difference between two dates.
 * Replaces the 30-day per month approximation.
 * Example: 2026-01-15 to 2026-03-15 = 2 months (not ~60 days / 30)
 *
 * @param {string} fromStr - Start date YYYY-MM-DD
 * @param {string} toStr - End date YYYY-MM-DD
 * @returns {number} Calendar months (minimum 1)
 */
export function differenceInCalendarMonths(fromStr, toStr) {
  if (!fromStr || !toStr) return 1;
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return 1;

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Adjust if target month day is less than origin month day
  if (to.getDate() < from.getDate()) {
    months -= 1;
  }
  return Math.max(1, months);
}

/**
 * Adds N months to a base date while keeping the original anchor day intact.
 *
 * Examples:
 *  - 2026-08-31 + 1 month (anchor 31) = 2026-09-30
 *  - 2026-08-31 + 2 months (anchor 31) = 2026-10-31 (recovers the 31st)
 *  - 2026-01-31 + 1 month (anchor 31) = 2026-02-28 (or 29 in leap year)
 *
 * @param {string} baseDateStr - Base date in YYYY-MM-DD format
 * @param {number} monthsToAdd - Number of months to add
 * @param {number} [anchorDay] - Anchor day (optional, if not passed extracted from baseDateStr)
 * @returns {string|null} - New date in YYYY-MM-DD format
 */
export function addMonthsPreservingAnchor(baseDateStr, monthsToAdd, anchorDay) {
  if (!baseDateStr || monthsToAdd === null || monthsToAdd === undefined || monthsToAdd < 0) return null;

  const [y, m, d] = baseDateStr.split('-').map(Number);
  const anchor = anchorDay || d;

  let targetMonth = m + monthsToAdd;
  let targetYear = y;

  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  while (targetMonth < 1) {
    targetMonth += 12;
    targetYear -= 1;
  }

  return getAnchorDateForTargetMonth(anchor, targetYear, targetMonth);
}

/**
 * Calculates payment cycle: how many full cycles have been paid, pending balance
 * and remainder within current cycle.
 * Unifies cycle logic used in computeNextPaymentDate, handlePayRemaining, etc.
 *
 * @param {Array} payments - Array of payments (chronologically ordered)
 * @param {number} planPrice - Plan price per cycle
 * @param {Object} [plan] - Optional plan for calculating effective amounts with correct currency
 * @returns {Object} { cycles, accumulatedBalance, currentRemaining, isFullyPaid }
 */
export function calculatePaymentCycle(payments, planPrice, plan) {
  if (!payments || payments.length === 0 || planPrice <= 0) {
    return { cycles: 0, accumulatedBalance: 0, currentRemaining: planPrice, isFullyPaid: false };
  }

  // Calculate total paid amount (ignore negative payments)
  const totalPaid = payments.reduce((sum, p) => {
    const amount = getEffectiveAmount(p, plan);
    return sum + (amount > 0 ? amount : 0);
  }, 0);

  // Handle zero payment case (should be same as no payment)
  if (totalPaid === 0) {
    return {
      cycles: 0,
      accumulatedBalance: 0,
      currentRemaining: planPrice,
      isFullyPaid: false
    };
  }

  // Calculate cycles and remainder
  const remainder = totalPaid % planPrice;
  const cycles = Math.floor(totalPaid / planPrice);

  // isFullyPaid is true when we've just completed a cycle (remainder === 0) and have made payments
  const isFullyPaid = remainder === 0;

  // currentRemaining represents how much has been paid toward current cycle
  // When isFullyPaid is true, we show 0 (completed cycle)
  // When isFullyPaid is false, we show amount paid toward current cycle
  const currentRemaining = isFullyPaid ? 0 : remainder;

  return {
    cycles,
    accumulatedBalance: 0, // Not used in UI logic, kept for API compatibility
    currentRemaining,
    isFullyPaid
  };
}

/**
 * Legacy/utilitary function to add months to a date.
 *
 * @param {string|Date} baseDate - Base date (YYYY-MM-DD format or Date object)
 * @param {number} monthsToAdd - Number of months to add
 * @returns {string|null} - New date in YYYY-MM-DD format
 */
export function addMonthsToDate(baseDate, monthsToAdd) {
  if (!baseDate || monthsToAdd < 0) return null;

  let baseStr;
  if (typeof baseDate === 'string') {
    baseStr = baseDate;
  } else {
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    baseStr = `${y}-${m}-${d}`;
  }

  const anchorDay = parseInt(baseStr.split('-')[2], 10);
  return addMonthsPreservingAnchor(baseStr, monthsToAdd, anchorDay);
}

/**
 * Calculates unified payment status for a client based on payments and plan.
 *
 * This function centralizes the payment status calculation logic that was duplicated
 * in ClientsTable.jsx and PaymentsTable.jsx.
 *
 * @param {Object} client - Client object with plan_id and associated payments
 * @param {Array} payments - Array of client's payments
 * @param {Function} getPlanForPayment - Function to get plan for a payment
 * @param {Function} getEffectiveAmount - Function to get effective amount of a payment
 * @param {Function} getPlanPrice - Function to get plan price
 * @param {Function} getEnrollmentFeePaid - Function to get enrollment fee paid amount
 * @param {Function} getPlanCurrency - Function to get plan currency (optional)
 * @returns {Object} - Payment status with isFullyPaid, remainingFormatted and currency
 */
export function getClientPaymentStatus(client, payments, getPlanForPayment, getEffectiveAmount, getPlanPrice, getEnrollmentFeePaid, getPlanCurrency) {
  if (!client || !client.plan_id) {
    return { isFullyPaid: true, remainingFormatted: "0.00", currency: "USD" };
  }

  const planPrice = getPlanPrice(client.plan_id);
  if (planPrice <= 0) {
    return { isFullyPaid: true, remainingFormatted: "0.00", currency: getPlanCurrency ? getPlanCurrency(getPlanForPayment(client)) : "USD" };
  }

  // 获取客户所有非归档支付（兼容客户换计划后旧支付 plan_id 未更新的场景）
  const clientPayments = payments.filter(
    (p) => p.client_id === client.id && !p.is_archived,
  );

  const totalPaidSoFar = clientPayments.reduce(
    (sum, p) => sum + getEffectiveAmount(p, getPlanForPayment(p)),
    0,
  );

  // Total price includes enrollment fee if already paid (one-time only)
  const enrollmentFeePaid = getEnrollmentFeePaid(client, clientPayments);
  const cyclePrice = planPrice + enrollmentFeePaid;
  const totalPrice = planPrice + enrollmentFeePaid;

  // CORRECT CALCULATION: enrollmentFee is ONE-TIME only, not per cycle
  // Cycle 1 price = planPrice + enrollmentFee, subsequent cycles = planPrice only
  let currentCyclePaid = 0;
  let currentCyclePrice = planPrice;
  let isFullyPaid = false;

  if (totalPaidSoFar === 0) {
    // No payments yet - current cycle is the first one with enrollment fee
    currentCyclePrice = totalPrice;
    currentCyclePaid = 0;
  } else if (totalPaidSoFar < cyclePrice) {
    // In first cycle, haven't completed it yet
    currentCyclePrice = totalPrice;
    currentCyclePaid = totalPaidSoFar;
  } else if ((totalPaidSoFar - enrollmentFeePaid) % planPrice === 0) {
    // Just completed a cycle (after enrollment)
    currentCyclePrice = planPrice;
    currentCyclePaid = planPrice;
    isFullyPaid = true;
  } else {
    // In progress of a cycle (after enrollment)
    const amountInCurrentCycle = totalPaidSoFar - enrollmentFeePaid - Math.floor((totalPaidSoFar - enrollmentFeePaid) / planPrice) * planPrice;
    currentCyclePrice = planPrice;
    currentCyclePaid = amountInCurrentCycle;
  }

  const currentRemaining = Math.max(0, currentCyclePrice - currentCyclePaid);

  const currency = getPlanCurrency ? getPlanCurrency(getPlanForPayment(client)) : "USD";

  // If current cycle is completed, no remaining to show
  if (isFullyPaid) {
    return { isFullyPaid: true, remainingFormatted: "0.00", currency };
  }

  return {
    isFullyPaid: false,
    remainingFormatted: currentRemaining.toFixed(2),
    currency,
  };
}

/**
 * Calculates the correct next_payment_date for a client based on chronological payment history.
 * For monthly plans: uses anchor day logic with accumulation
 * For daily/weekly plans: each payment period is independent, no accumulation
 *
 * BUSINESS RULES FOR MONTHLY PLANS:
 * 1. Anchor Day Preservation: Cutoff always corresponds to join_date day (or month end if month shorter).
 * 2. Continuous Renewals: If active client pays before or on due date, coverage is extended.
 * 3. Reactivations after Inactivity: If client returns after months without paying, payment reactivates service
 *    until next anchor day cutoff (does not drag past cutoffs).
 * 4. Partial Payments: Balance accumulates until completing 1 cycle price before extending the date.
 * 5. If payment is maintenance, it is treated as a full coverage cycle.
 * 6. No Payments: Projects first due date to 1 month from join_date.
 *
 * BUSINESS RULES FOR DAILY/WEEKLY PLANS:
 * 1. Each payment grants access for exactly N periods (where N = payment amount / plan price)
 * 2. No accumulation of partial payments across periods (each day/week stands alone)
 * 3. No concept of "next payment date" - access is granted per period paid
 * 4. Maintenance payments treated as full coverage cycles (grant at least 1 period)
 * 5. Client status based on whether current period is paid
 *
 * @param {string} joinDate - Client's join date (YYYY-MM-DD)
 * @param {Array}  clientPayments - Client's payments for current plan
 * @param {Object} plan - Client's plan
 * @param {number} planPrice - Plan price per period
 * @returns {string|null} - Calculated next payment date (YYYY-MM-DD) for monthly plans, null for daily/weekly
 */
export function computeNextPaymentDate(joinDate, clientPayments, plan, planPrice, enrollmentFee = 0) {
  if (!joinDate || planPrice <= 0) return null;

  const frequency = getPlanFrequency(plan);

  // For daily and weekly plans, there's no concept of next payment date
  // Access is granted per period paid
  if (frequency === 'daily' || frequency === 'weekly') {
    return null;
  }

  // For monthly plans, use existing logic
  // Total cycle price includes enrollment fee (one-time only)
  const cyclePrice = planPrice + enrollmentFee;

  const anchorDay = parseInt(joinDate.split('-')[2], 10);

  // If no payments, the next payment date is join_date + 1 month
  if (!clientPayments || clientPayments.length === 0) {
    return addMonthsPreservingAnchor(joinDate, 1, anchorDay);
  }

  // Sort payments chronologically
  const sortedPayments = [...clientPayments].sort(
    (a, b) => new Date(a.payment_date) - new Date(b.payment_date)
  );

  let currentDueDate = null;
  let totalEffectiveSoFar = 0;
  let maintenanceBonusSoFar = 0;
  let previousAccumulatedMonths = 0;

  for (const p of sortedPayments) {
    // Skip payments made BEFORE the client joined
    if (p.payment_date < joinDate) {
      continue;
    }

    const [payYear, payMonth, payDay] = p.payment_date.split('-').map(Number);

    const effective = getEffectiveAmount(p, plan);
    const isMaint = isMaintenancePayment(p);
    const isMaintBonus = isMaint && effective > 0 && effective < planPrice;

    // Update running totals
    totalEffectiveSoFar += effective;
    if (isMaintBonus) {
      maintenanceBonusSoFar++;
    }

    // CORRECT CYCLE CALCULATION: enrollmentFee is ONE-TIME only, not per cycle
    // Cycle 1 price = planPrice + enrollmentFee, subsequent cycles = planPrice only
    let baseCycles = 0;
    if (totalEffectiveSoFar >= cyclePrice) {
      baseCycles = 1 + Math.floor((totalEffectiveSoFar - cyclePrice) / planPrice);
    } else {
      baseCycles = Math.floor(totalEffectiveSoFar / cyclePrice);
    }
    const accumulatedMonths = baseCycles + maintenanceBonusSoFar;

    if (accumulatedMonths <= 0) {
      previousAccumulatedMonths = accumulatedMonths;
      continue;
    }

    const deltaAccumulated = accumulatedMonths - previousAccumulatedMonths;

    if (!currentDueDate) {
      // First time we have enough for at least one cycle
      const baseTarget = addMonthsPreservingAnchor(joinDate, accumulatedMonths, anchorDay);
      if (p.payment_date > baseTarget) {
        // Initial late payment
        if (payDay < anchorDay) {
          let target = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (accumulatedMonths > 1) {
            target = addMonthsPreservingAnchor(target, accumulatedMonths - 1, anchorDay);
          }
          currentDueDate = target;
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            getAnchorDateForTargetMonth(anchorDay, payYear, payMonth),
            accumulatedMonths,
            anchorDay
          );
        }
      } else {
        currentDueDate = baseTarget;
      }
    } else {
      if (p.payment_date <= currentDueDate) {
        // On-time or early payment: extend by deltaAccumulated
        currentDueDate = addMonthsPreservingAnchor(currentDueDate, deltaAccumulated, anchorDay);
      } else {
        // Reactivation after inactivity: reactivates current cycle anchored to client's day.
        // Always advance to at least the next anchor day when paying after due date.
        if (payDay < anchorDay) {
          currentDueDate = getAnchorDateForTargetMonth(anchorDay, payYear, payMonth);
          if (deltaAccumulated > 1) {
            currentDueDate = addMonthsPreservingAnchor(currentDueDate, deltaAccumulated - 1, anchorDay);
          }
        } else {
          currentDueDate = addMonthsPreservingAnchor(
            getAnchorDateForTargetMonth(anchorDay, payYear, payMonth),
            Math.max(deltaAccumulated, 1),
            anchorDay
          );
        }
      }
    }

    previousAccumulatedMonths = accumulatedMonths;
  }

  // Si después de procesar todos los pagos no tenemos una fecha de vencimiento,
  // proyectamos el primer vencimiento a partir de join_date (un mes adelante).
  return currentDueDate || addMonthsPreservingAnchor(joinDate, 1, anchorDay);
}

/**
 * Recalculates and persists a client's next_payment_date after registering/editing/deleting a payment.
 *
 * @param {Object} params
 * @param {string} params.clientId - Client ID
 * @param {string} params.planId   - Current plan ID for client
 * @returns {Promise<{success: boolean, newDate?: string, cyclesExtended?: number, error?: any}>}
 */
export async function recalculateNextPaymentDate({ clientId, planId, payments }) {
  try {
    // 1. Client data
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select(`
        id,
        join_date,
        next_payment_date,
        plan_id,
        enrollment_paid,
        plans (
          id,
          price,
          currency,
          frequency
        )
      `)
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client for recalculation: ', clientError);
      return { success: false, error: clientError };
    }

    const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;

    if (planPrice <= 0) {
      console.error('Plan price is invalid or zero');
      return { success: false, error: 'Plan price is invalid' };
    }

    let allPayments = [];
    // Always attempt to fetch payments from DB to get complete history
    const { data: fetchedPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date, reference')
      .eq('client_id', clientId)
      .eq('plan_id', planId)
      .eq('is_archived', false)
      .order('payment_date', { ascending: true });

    if (paymentsError) {
      console.error('Error fetching payments for recalculation:', paymentsError);
      // If we have a payments hint (e.g. from recent insert/update), we may still want to use it
      if (!payments || payments.length === 0) {
        return { success: false, error: paymentsError };
      }
      // Otherwise, we'll use the payments hint and log a warning
      console.warn('Using payments hint due to fetch error');
      allPayments = payments || [];
    } else {
      allPayments = fetchedPayments;
    }

    // If we were given specific payments to include (e.g. from a recent insert/update),
    // merge them in, avoiding duplicates by id
    if (payments && payments.length > 0) {
      const paymentIds = new Set(allPayments.map(p => p.id));
      for (const p of payments) {
        if (!paymentIds.has(p.id)) {
          allPayments.push(p);
          paymentIds.add(p.id);
        }
      }
      // Re-sort by date to ensure chronological order
      allPayments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
    }

    // 3. Calculate correct date with business rules
    // If client did "clean slate" and has no active payments,
    // next payment date should be null until they pay
    const hasHadReset = !!clientData.original_join_date;
    const hasActivePayments = (allPayments || []).length > 0;

    let newNextPaymentDate;
    if (hasHadReset && !hasActivePayments) {
      // Client with reset but no active payments -> no next payment date
      newNextPaymentDate = null;
    } else {
      const enrollmentFee = clientData.enrollment_paid ? INSCRIPTION_PRICE : 0;
      newNextPaymentDate = computeNextPaymentDate(
        clientData.join_date,
        allPayments || [],
        clientData.plans,
        planPrice,
        enrollmentFee
      );
    }

    // 4. Update only if date changed
    // For daily/weekly plans, newNextPaymentDate is null — clear any stale date
    if (newNextPaymentDate !== clientData.next_payment_date) {
      const { error } = await client
        .from('clients')
        .update({ next_payment_date: newNextPaymentDate })
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client next_payment_date:', error);
        return { success: false, error };
      }

      return {
        success: true,
        newDate: newNextPaymentDate,
        previousDate: clientData.next_payment_date,
      };
    }

    // No change
    return {
      success: true,
      newDate: clientData.next_payment_date,
      // Maintain compatibility with old cyclesExtended field
      cyclesExtended: 0,
      isPartialPayment: true
    };
  } catch (err) {
    console.error('Error recalculating client next_payment_date:', err);
    return { success: false, error: err };
  }
}

/**
 * Recalculates next_payment_date for ALL clients.
 * Useful for maintenance or data migration.
 *
 * @returns {Promise<{success: boolean, updated: number, total: number, errors: string[]}>}
 */
export async function recalculateAllNextPaymentDates() {
  try {
    // 1. Get all clients
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id,
        join_date,
        next_payment_date,
        plan_id,
        enrollment_paid,
        plans (
          id,
          price,
          currency,
          frequency
        )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, updated: 0, total: 0, errors: [] };
    }

    // 2. Get all payments ordered by date (excluding archived)
    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date')
      .eq('is_archived', false)
      .order('payment_date', { ascending: true });

    if (paymentsError) throw paymentsError;

    const updates = [];
    const errors = [];

    // 3. Process each client
    for (const clientData of allClients) {
      if (!clientData.join_date) {
        errors.push(`Client ${clientData.id}: missing join date`);
        continue;
      }

      try {
        const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;

        if (planPrice <= 0) {
          errors.push(`Client ${clientData.id}: invalid plan price`);
          continue;
        }

        // Client's payments - filtered by plan_id to only include current plan payments
        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id && p.plan_id === clientData.plan_id
        );

        // Calculate correct date with business rules
        const enrollmentFee = clientData.enrollment_paid ? INSCRIPTION_PRICE : 0;
        const newNextPaymentDate = computeNextPaymentDate(
          clientData.join_date,
          clientPayments,
          clientData.plans,
          planPrice,
          enrollmentFee
        );

        // For daily/weekly plans, newNextPaymentDate is null — clear any stale date
        if (newNextPaymentDate !== clientData.next_payment_date) {
          updates.push({
            id: clientData.id,
            next_payment_date: newNextPaymentDate
          });
        }
      } catch (err) {
        errors.push(`Client ${clientData.id}: ${err.message}`);
      }
    }

    // 4. Apply updates in batches of 50
    if (updates.length > 0) {
      const batchSize = 50;
      let updatedCount = 0;

      for (let i = 0; i < updates.length; i += batchSize) {
        const chunk = updates.slice(i, i + batchSize);
        await Promise.all(chunk.map(async (u) => {
          const { error } = await client
            .from('clients')
            .update({ next_payment_date: u.next_payment_date })
            .eq('id', u.id);

          if (error) {
            errors.push(`Error updating ${u.id}: ${error.message}`);
          } else {
            updatedCount++;
          }
        }));
      }

      return {
        success: errors.length === 0,
        updated: updatedCount,
        total: allClients.length,
        errors
      };
    }

    return { success: true, updated: 0, total: allClients.length, errors: [] };
  } catch (err) {
    console.error('Error recalculating all payment dates:', err);
    return { success: false, updated: 0, total: 0, errors: [err.message] };
  }
}

/**
 * Comprehensive audit of all clients' next_payment_date vs expected value
 * Returns detailed list of discrepancies for manual review
 *
 * @returns {Promise<{
 *   success: boolean,
 *   total: number,
 *   discrepancies_count: number,
 *   discrepancies: Array<{
 *     id: string,
 *     name: string,
 *     join_date: string,
 *     original_join_date: string|null,
 *     stored_next_payment_date: string|null,
 *     expected_next_payment_date: string|null,
 *     days_difference: number|null,
 *     plan_name: string,
 *     plan_price: number,
 *     plan_currency: string,
 *     plan_frequency: string,
 *     enrollment_paid: boolean|null,
 *     total_paid: number,
 *     cycles_paid: number,
 *     last_payment_date: string|null,
 *     payment_count: number
 *   }>,
 *   errors: string[]
 * }>}
 */
export async function auditAllClientPaymentDates() {
  try {
    // 1. Get all clients with their plan info
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        join_date,
        next_payment_date,
        plan_id,
        enrollment_paid,
        original_join_date,
        plans (
          id,
          name,
          price,
          currency,
          frequency
        )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, total: 0, discrepancies_count: 0, discrepancies: [], errors: [] };
    }

    // 2. Get all payments ordered by date (excluding archived)
    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date')
      .eq('is_archived', false)
      .order('payment_date', { ascending: true });

    if (paymentsError) throw paymentsError;

    const discrepancies = [];
    const errors = [];

    // 3. Process each client
    for (const clientData of allClients) {
      try {
        if (!clientData.join_date) {
          errors.push(`Client ${clientData.id}: missing join date`);
          continue;
        }

        const planPrice = clientData.plans ? parseFloat(clientData.plans.price) || 0 : 0;
        if (planPrice <= 0) {
          errors.push(`Client ${clientData.id}: invalid plan price`);
          continue;
        }

        // Get client's payments (not filtering by plan_id to include plan change history)
        const clientPayments = (allPayments || []).filter(
          p => p.client_id === clientData.id
        );

        // Calculate correct date with business rules
        const enrollmentFee = clientData.enrollment_paid ? INSCRIPTION_PRICE : 0;
        const expectedNextPaymentDate = computeNextPaymentDate(
          clientData.join_date,
          clientPayments,
          clientData.plans,
          planPrice,
          enrollmentFee
        );

        // Compare stored vs expected
        const storedDate = clientData.next_payment_date;
        const datesMatch = storedDate === expectedNextPaymentDate;

        if (!datesMatch) {
          // Calculate days difference for reporting
          let daysDifference = null;
          if (storedDate && expectedNextPaymentDate) {
            const stored = new Date(storedDate);
            const expected = new Date(expectedNextPaymentDate);
            daysDifference = Math.round((stored.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
          } else if (!storedDate && expectedNextPaymentDate) {
            daysDifference = -999; // Stored null, expected date
          } else if (storedDate && !expectedNextPaymentDate) {
            daysDifference = 999; // Stored date, expected null
          }

          // Get payment summary
          const totalPaid = clientPayments.reduce(
            (sum, p) => sum + getEffectiveAmount(p, clientData.plans),
            0
          );
          const cycles = Math.floor(totalPaid / planPrice);
          const lastPaymentDate = clientPayments.length > 0
            ? Math.max(...clientPayments.map(p => new Date(p.payment_date).getTime()))
            : null;

          discrepancies.push({
            id: clientData.id,
            name: `${clientData.first_name} ${clientData.last_name}`,
            join_date: clientData.join_date,
            original_join_date: clientData.original_join_date,
            stored_next_payment_date: storedDate,
            expected_next_payment_date: expectedNextPaymentDate,
            days_difference: daysDifference,
            plan_name: clientData.plans?.name || 'Unknown',
            plan_price: planPrice,
            plan_currency: clientData.plans?.currency || 'USD',
            plan_frequency: clientData.plans?.frequency || 'monthly',
            enrollment_paid: clientData.enrollment_paid,
            total_paid: totalPaid,
            cycles_paid: cycles,
            last_payment_date: lastPaymentDate ? new Date(lastPaymentDate).toISOString().split('T')[0] : null,
            payment_count: clientPayments.length
          });
        }
      } catch (err) {
        errors.push(`Client ${clientData.id}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: allClients.length,
      discrepancies_count: discrepancies.length,
      discrepancies,
      errors
    };
  } catch (err) {
    console.error('Error auditing all payment dates:', err);
    return { success: false, total: 0, discrepancies_count: 0, discrepancies: [], errors: [err.message] };
  }
}

/**
 * Audits next_payment_date for ALL clients without modifying anything.
 * Compares stored value against expected value based on actual payments.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   total: number,
 *   correct: number,
 *   discrepancies: Array<{
 *     id: string,
 *     name: string,
 *     join_date: string,
 *     stored: string,
*     expected: string,
 *     totalPaid: number,
 *     cycles: number,
 *   }>,
 *   errors: string[]
 * }>}
 */
export async function auditNextPaymentDates() {
  try {
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        join_date,
        next_payment_date,
        plan_id,
        enrollment_paid,
        plans ( id, price, currency, frequency )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, total: 0, correct: 0, discrepancies: [], errors: [] };
    }

    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd, amount_bs, payment_type, discount_type, discount_value, payment_date')
      .order('payment_date', { ascending: true });

    if (paymentsError) throw paymentsError;

    const discrepancies = [];
    const errors = [];

    for (const c of allClients) {
      if (!c.join_date) {
        errors.push(`${c.first_name} ${c.last_name} (${c.id}): missing join_date`);
        continue;
      }

      const planPrice = c.plans ? parseFloat(c.plans.price) || 0 : 0;
      if (planPrice <= 0) {
        errors.push(`${c.first_name} ${c.last_name} (${c.id}): invalid plan price`);
        continue;
      }

      const clientPayments = (allPayments || []).filter(
        p => p.client_id === c.id && p.plan_id === c.plan_id
      );
      const totalPaid = clientPayments.reduce(
        (sum, p) => sum + getEffectiveAmount(p, c.plans),
        0
      );
      const cycles   = Math.floor(totalPaid / planPrice);
      const enrollmentFee = c.enrollment_paid ? INSCRIPTION_PRICE : 0;
      const expected = computeNextPaymentDate(c.join_date, clientPayments, c.plans, planPrice, enrollmentFee);

      if (expected !== c.next_payment_date) {
        discrepancies.push({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          join_date: c.join_date,
          stored: c.next_payment_date,
          expected,
          totalPaid,
          cycles,
        });
      }
    }

    return {
      success: true,
      total: allClients.length,
      correct: allClients.length - discrepancies.length - errors.length,
      discrepancies,
      errors,
    };
  } catch (err) {
    console.error('Error auditing payment dates:', err);
    return { success: false, total: 0, correct: 0, discrepancies: [], errors: [err.message] };
  }
}

/**
 * Fixes next_payment_date for clients with discrepancies.
 * Receives the `discrepancies` array returned by auditNextPaymentDates().
 *
 * @param {Array<{id: string, expected: string}>} discrepancies
 * @returns {Promise<{success: boolean, updated: number, errors: string[]}>}
 */
export async function fixAuditDiscrepancies(discrepancies) {
  if (!discrepancies || discrepancies.length === 0) {
    return { success: true, updated: 0, errors: [] };
  }

  const errors = [];
  let updated = 0;

  await Promise.all(discrepancies.map(async (d) => {
    const { error } = await client
      .from('clients')
      .update({ next_payment_date: d.expected })
      .eq('id', d.id);

    if (error) {
      errors.push(`${d.name} (${d.id}): ${error.message}`);
    } else {
      updated++;
    }
  }));

  return { success: errors.length === 0, updated, errors };
}

/**
 * Calculates days remaining until next payment.
 * Returns negative number if overdue.
 *
 * @param {string} nextPaymentDate - Next payment date (YYYY-MM-DD)
 * @returns {number} - Days remaining (negative if overdue)
 */
export function calculateDaysUntilPayment(nextPaymentDate, joinDate) {
  if (!nextPaymentDate) return null;

  try {
    let targetYear, targetMonth, targetDay;
    if (typeof nextPaymentDate === 'string') {
      const nextParts = nextPaymentDate.split('-');
      targetYear = parseInt(nextParts[0], 10);
      targetMonth = parseInt(nextParts[1], 10) - 1;
      targetDay = parseInt(nextParts[2], 10);
    } else {
      targetYear = nextPaymentDate.getFullYear();
      targetMonth = nextPaymentDate.getMonth();
      targetDay = nextPaymentDate.getDate();
    }

    const nextPayment = new Date(targetYear, targetMonth, targetDay);
    nextPayment.setHours(0, 0, 0, 0);

    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    todayLocal.setHours(0, 0, 0, 0);

    const diffTime = nextPayment.getTime() - todayLocal.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error('Error calculating days until payment:', error);
    return null;
  }
}

/**
 * Gets payment status color based on days remaining.
 *
 * @param {number} daysLeft - Days remaining
 * @returns {string} - CSS color class
 */
export function getPaymentStatusColor(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'text-gray-500';
  if (daysLeft < 0) return 'text-red-500';      // Overdue
  if (daysLeft === 0) return 'text-yellow-500';  // Today (0 days)
  if (daysLeft <= 7) return 'text-orange-500';  // Due soon (≤7 days)
  if (daysLeft <= 15) return 'text-yellow-500'; // Due (≤15 days)
  return 'text-green-500';                      // Active (>15 days)
}

/**
 * Calculates and updates client status based on payments.
 * Logic:
 * - Has sufficient payments for at least 1 cycle AND next payment not overdue → "active"
 * - Next payment overdue (negative days) → "inactive"
 * - Insufficient payments → "pending" (or "inactive" if preferred)
 *
 * @param {string} clientId - Client ID
 * @param {string} planId - Current plan ID for client
 * @returns {Promise<{success: boolean, status?: string, previousStatus?: string, error?: any}>}
 */
export async function updateClientStatus(clientId, planId) {
  try {
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select(`
        id,
        status,
        next_payment_date,
        join_date,
        enrollment_paid,
        plan_id,
        plans (
          id,
          price,
          currency
        )
      `)
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client for status update: ', clientError);
      return { success: false, error: clientError };
    }

    const plan = clientData.plans;
    const planPrice = plan ? parseFloat(plan.price) || 0 : 0;

    if (planPrice <= 0) {
      return { success: false, error: 'Plan price is invalid or zero' };
    }

    // Get ALL non-archived payments for client (not filtering by plan_id)
    const { data: payments, error: paymentsError } = await client
      .from('payments')
      .select('id, amount_usd, amount_bs, exchange_rate, payment_type, discount_type, discount_value, payment_date, is_archived, reference')
      .eq('client_id', clientId)
      .eq('is_archived', false);

    if (paymentsError) {
      console.error('Error fetching payments for status update:', paymentsError);
      return { success: false, error: paymentsError };
    }

    // Calculate total paid so far (including all previous cycles)
    const totalPaid = (payments || []).reduce(
      (sum, p) => sum + getEffectiveAmount(p, plan),
      0
    );

    // Calculate days since last payment
    let daysSinceLastPayment = 999;
    if ((payments || []).length > 0) {
      const lastPaymentDate = Math.max(
        ...(payments || []).map(p => new Date(p.payment_date).getTime())
      );
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      daysSinceLastPayment = Math.floor((now.getTime() - lastPaymentDate) / (1000 * 60 * 60 * 24));
    }

    const cycles = Math.floor(totalPaid / planPrice);
    const remainder = totalPaid % planPrice;
    const isFullyPaid = remainder < 0.001;
    const enrollmentFee = clientData.enrollment_paid ? INSCRIPTION_PRICE : 0;
    const totalPrice = planPrice + enrollmentFee;

    let newStatus;

    // Get plan frequency for special handling
    const planFrequency = getPlanFrequency(plan);

    // New algorithm based on days since last payment and plan frequency
    if ((payments || []).length === 0) {
      // No payments: check if new client or reactivated
      const joinDate = new Date(clientData.join_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // If join date is recent (<= 7 days) or in future, it's "pending"
      // This covers "clean slate" cases where payment hasn't been made yet
      const daysSinceJoin = Math.floor((today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      newStatus = (today < joinDate || daysSinceJoin <= 7) ? 'pendiente' : 'inactivo';
    } else if (isFullyPaid && cycles >= MAX_CYCLES) {
      // Fully paid (12+ cycles)
      newStatus = 'finalizado';
    } else if (planFrequency === 'daily' || planFrequency === 'weekly') {
      // For daily/weekly plans: check if current period is paid
      // Calculate if today falls within a paid period
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get the most recent payment date
      const mostRecentPaymentDate = Math.max(
        ...(payments || []).map(p => new Date(p.payment_date).getTime())
      );

      const mostRecentPayment = new Date(mostRecentPaymentDate);
      mostRecentPayment.setHours(0, 0, 0, 0);

      // Calculate periods since most recent payment
      let periodsSinceLastPayment = 0;
      if (planFrequency === 'daily') {
        periodsSinceLastPayment = Math.floor((today.getTime() - mostRecentPayment.getTime()) / (1000 * 60 * 60 * 24));
      } else if (planFrequency === 'weekly') {
        periodsSinceLastPayment = Math.floor((today.getTime() - mostRecentPayment.getTime()) / (1000 * 60 * 60 * 24 * 7));
      }

      // Calculate total periods paid (including maintenance bonuses)
      const totalPaid = (payments || []).reduce(
        (sum, p) => sum + getEffectiveAmount(p, plan),
        0
      );

      const totalPeriodsPaid = Math.floor(totalPaid / planPrice);
      const maintenancePeriods = (payments || []).filter(p =>
        isMaintenancePayment(p) && getEffectiveAmount(p, plan) > 0 && getEffectiveAmount(p, plan) < planPrice
      ).length;

      const totalEffectivePeriods = totalPeriodsPaid + maintenancePeriods;

      // Client is active if we've paid for at least as many periods as have passed
      // Or if we're within the grace period of the most recent payment
      if (totalEffectivePeriods > periodsSinceLastPayment) {
        newStatus = 'activo';
      } else {
        // Check if we're within the same period as the most recent payment
        // (allow same-day activity for daily, same-week for weekly)
        const isSamePeriod = periodsSinceLastPayment === 0;
        newStatus = isSamePeriod ? 'activo' : 'inactivo';
      }
    } else if (daysSinceLastPayment <= MAX_DAYS_ACTIVE) {
      // Recent payment (<= 30 days)
      newStatus = 'activo';
    } else {
      // No recent payment
      newStatus = 'inactivo';
    }

    if (newStatus !== clientData.status) {
      const { error } = await client
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client status:', error);
        return { success: false, error };
      }

      return {
        success: true,
        status: newStatus,
        previousStatus: clientData.status,
      };
    }

    return {
      success: true,
      status: clientData.status,
      previousStatus: clientData.status,
      unchanged: true,
    };
  } catch (err) {
    console.error('Error updating client status:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fixes status for ALL clients based on payments.
 * Improved logic:
 * - Active: has recent payments (<= 30 days) for monthly plans, or current period paid for daily/weekly
 * - Inactive: no payments or last payment > 30 days ago for monthly, or current period not paid for daily/weekly
 * - Pending: no payments and start date in future
 * - Finalized: has 12+ fully paid cycles
 *
 * @returns {Promise<{success: boolean, updated: number, total: number, errors: string[]}>}
 */
export async function fixAllClientStatuses() {
  try {
    const { data: allClients, error: fetchError } = await client
      .from('clients')
      .select(`
        id,
        status,
        next_payment_date,
        join_date,
        enrollment_paid,
        plan_id,
        plans (
          id,
          price,
          currency,
          frequency
        )
      `);

    if (fetchError) throw fetchError;
    if (!allClients || allClients.length === 0) {
      return { success: true, updated: 0, total: 0, errors: [] };
    }

    const { data: allPayments, error: paymentsError } = await client
      .from('payments')
      .select('id, client_id, plan_id, amount_usd, amount_bs, exchange_rate, payment_type, discount_type, discount_value, is_archived, reference');

    if (paymentsError) throw paymentsError;

    // Filter only non-archived payments
    const validPayments = (allPayments || []).filter(p => !p.is_archived);

    // Group payments by client
    const clientPaymentsMap = {};
    validPayments.forEach(p => {
      if (!clientPaymentsMap[p.client_id]) clientPaymentsMap[p.client_id] = [];
      clientPaymentsMap[p.client_id].push(p);
    });

    const INSCRIPTION_PRICE = 5;
    const MAX_DAYS_ACTIVE = 30;
    const MAX_CYCLES = 12;

    const updates = [];
    const errors = [];

    for (const clientData of allClients) {
      try {
        const plan = clientData.plans;
        const planPrice = plan ? parseFloat(plan.price) || 0 : 0;
        const planFrequency = getPlanFrequency(plan);

        if (planPrice <= 0) continue;

        // Get all client payments (not filtering by plan_id to include history)
        const clientPayments = clientPaymentsMap[clientData.id] || [];
        const totalPaid = clientPayments.reduce(
          (sum, p) => sum + getEffectiveAmount(p, plan),
          0
        );

        let newStatus;

        // New algorithm based on plan frequency
        if (clientPayments.length === 0) {
          // No active payments:
          // - If has original_join_date (did clean slate), remains pending until payment
          // - If join date is recent (<= 7 days) or in future, is pending
          // - Otherwise, is inactive
          const hasHadReset = !!clientData.original_join_date;
          const joinDate = new Date(clientData.join_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysSinceJoin = Math.floor((today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
          newStatus = (hasHadReset || today < joinDate || daysSinceJoin <= 7) ? 'pendiente' : 'inactivo';
        } else if (planFrequency === 'monthly') {
          // Monthly plan logic (existing)
          const cycles = Math.floor(totalPaid / planPrice);
          const remainder = totalPaid % planPrice;
          const isFullyPaid = remainder < 0.001;
          const enrollmentFee = clientData.enrollment_paid ? INSCRIPTION_PRICE : 0;
          const totalPrice = planPrice + enrollmentFee;

          // Calculate days since last payment
          let daysSinceLastPayment = 999;
          if (clientPayments.length > 0) {
            const lastPaymentDate = Math.max(
              ...clientPayments.map(p => new Date(p.payment_date).getTime())
            );
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            daysSinceLastPayment = Math.floor((now.getTime() - lastPaymentDate) / (1000 * 60 * 60 * 24));
          }

          if (isFullyPaid && cycles >= MAX_CYCLES) {
            newStatus = 'finalizado';
          } else if (daysSinceLastPayment <= MAX_DAYS_ACTIVE) {
            newStatus = 'activo';
          } else {
            newStatus = 'inactivo';
          }
        } else if (planFrequency === 'daily' || planFrequency === 'weekly') {
          // Daily/weekly plan logic
          // Calculate if current period is paid
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Get the most recent payment date
          const mostRecentPaymentDate = Math.max(
            ...(payments || []).map(p => new Date(p.payment_date).getTime())
          );

          const mostRecentPayment = new Date(mostRecentPaymentDate);
          mostRecentPayment.setHours(0, 0, 0, 0);

          // Calculate periods since most recent payment
          let periodsSinceLastPayment = 0;
          if (planFrequency === 'daily') {
            periodsSinceLastPayment = Math.floor((today.getTime() - mostRecentPayment.getTime()) / (1000 * 60 * 60 * 24));
          } else if (planFrequency === 'weekly') {
            periodsSinceLastPayment = Math.floor((today.getTime() - mostRecentPayment.getTime()) / (1000 * 60 * 60 * 24 * 7));
          }

          // Calculate total periods paid (including maintenance bonuses)
          const totalPaidAmount = (payments || []).reduce(
            (sum, p) => sum + getEffectiveAmount(p, plan),
            0
          );

          const totalPeriodsPaid = Math.floor(totalPaidAmount / planPrice);
          const maintenancePeriods = (payments || []).filter(p =>
            isMaintenancePayment(p) && getEffectiveAmount(p, plan) > 0
          ).length;

          const totalEffectivePeriods = totalPeriodsPaid + maintenancePeriods;

          // Client is active if we've paid for at least as many periods as have passed
          // Or if we're within the same period as the most recent payment
          if (totalEffectivePeriods > periodsSinceLastPayment) {
            newStatus = 'activo';
          } else {
            // Check if we're within the same period as the most recent payment
            // (allow same-day activity for daily, same-week for weekly)
            const isSamePeriod = periodsSinceLastPayment === 0;
            newStatus = isSamePeriod ? 'activo' : 'inactivo';
          }
        }

        if (newStatus !== clientData.status) {
          updates.push({
            id: clientData.id,
            name: `${clientData.first_name} ${clientData.last_name}`,
            oldStatus: clientData.status,
            newStatus,
            daysSinceLast: planFrequency === 'monthly' ?
              ((clientPayments.length > 0) ?
                Math.floor((new Date().getTime() - Math.max(...clientPayments.map(p => new Date(p.payment_date).getTime()))) / (1000 * 60 * 60 * 24)) : 999) :
              (planFrequency === 'daily' || planFrequency === 'weekly') ? 0 : 999, // Placeholder for non-monthly
            totalPaid: totalPaid.toFixed(2)
          });
        }
      } catch (err) {
        errors.push(`Client ${clientData.id}: ${err.message}`);
      }
    }

    if (updates.length > 0) {
      let updatedCount = 0;

      for (const u of updates) {
        const { error } = await client
          .from('clients')
          .update({ status: u.newStatus })
          .eq('id', u.id);

        if (error) {
          errors.push(`${u.name}: ${error.message}`);
        } else {
          updatedCount++;
        }
      }

      return {
        success: errors.length === 0,
        updated: updatedCount,
        total: allClients.length,
        changes: updates,
        errors
      };
    }

    return { success: true, updated: 0, total: allClients.length, changes: [], errors: [] };
  } catch (err) {
    console.error('Error fixing all client statuses:', err);
    return { success: false, updated: 0, total: 0, errors: [err.message] };
  }
}