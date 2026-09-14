export const INSCRIPTION_PRICE_USD = 5;

/**
 * Normaliza el precio de un plan según su moneda base.
 * Si el plan usa 'BS', usa el precio tal cual (bolívares fijos).
 * Si usa 'USD', usa el precio tal cual (dólares fijos).
 * Esto protege los cálculos de fluctuaciones del tipo de cambio.
 */
export function getPlanPriceInBaseCurrency(plan, rate = 310) {
  if (!plan) return 0;
  const price = parseFloat(plan.price) || 0;
  const currency = (plan.currency || 'USD').toUpperCase();
  // El precio base es siempre en la moneda declarada del plan (fijo)
  return price;
}

export function getPlanCurrency(plan) {
  if (!plan) return 'USD';
  return (plan.currency || 'USD').toUpperCase();
}

/**
 * Devuelve el precio del plan en USD para comparar con pagos USD
 * (solo si necesitas comparar con la cuenta USD; para cálculos de ciclo
 * lo más seguro es usar la moneda base).
 */
export function getPlanPriceInUSD(plan, rate = 310) {
  const currency = getPlanCurrency(plan);
  const price = getPlanPriceInBaseCurrency(plan);
  if (currency === 'USD') return price;
  // BS → USD usando tasa activa
  return rate > 0 ? price / rate : price;
}

export function getPlanPriceInBS(plan, rate = 310) {
  const currency = getPlanCurrency(plan);
  const price = getPlanPriceInBaseCurrency(plan);
  if (currency === 'BS') return price;
  // USD → BS
  return rate > 0 ? price * rate : price;
}
