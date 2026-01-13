CREATE OR REPLACE FUNCTION search_payments_with_filters(
  search_term TEXT DEFAULT NULL,
  filter_plan_id UUID DEFAULT NULL,
  filter_payment_type TEXT DEFAULT NULL,
  filter_bank TEXT DEFAULT NULL,
  filter_date_from DATE DEFAULT NULL,
  filter_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  plan_id UUID,
  amount_usd NUMERIC,
  amount_bs NUMERIC,
  exchange_rate NUMERIC,
  payment_date DATE,
  reference TEXT,
  bank TEXT,
  payment_type TEXT,
  phone_payment TEXT,
  created_at TIMESTAMPTZ,
  clients JSON,
  plans JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.client_id,
    p.plan_id,
    p.amount_usd,
    p.amount_bs,
    p.exchange_rate,
    p.payment_date,
    p.reference,
    p.bank,
    p.payment_type,
    p.phone_payment,
    p.created_at,
    json_build_object(
      'id', c.id,
      'first_name', c.first_name,
      'last_name', c.last_name,
      'cedula', c.cedula
    ) AS clients,
    json_build_object(
      'id', pl.id,
      'name', pl.name,
      'price', pl.price
    ) AS plans
  FROM
    payments p
  LEFT JOIN
    clients c ON p.client_id = c.id
  LEFT JOIN
    plans pl ON p.plan_id = pl.id
  WHERE
    -- Búsqueda por cliente
    (search_term IS NULL OR 
     c.first_name ILIKE '%' || search_term || '%' OR
     c.last_name ILIKE '%' || search_term || '%' OR
     c.cedula ILIKE '%' || search_term || '%')
    -- Filtro por plan
    AND (filter_plan_id IS NULL OR p.plan_id = filter_plan_id)
    -- Filtro por tipo de pago
    AND (filter_payment_type IS NULL OR p.payment_type = filter_payment_type)
    -- Filtro por banco
    AND (filter_bank IS NULL OR p.bank = filter_bank)
    -- Filtro por fecha desde
    AND (filter_date_from IS NULL OR p.payment_date >= filter_date_from)
    -- Filtro por fecha hasta
    AND (filter_date_to IS NULL OR p.payment_date <= filter_date_to)
  ORDER BY p.payment_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Mantener la función anterior por compatibilidad temporal
CREATE OR REPLACE FUNCTION search_payments_by_client(search_term TEXT)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  plan_id UUID,
  amount_usd NUMERIC,
  amount_bs NUMERIC,
  exchange_rate NUMERIC,
  payment_date DATE,
  reference TEXT,
  bank TEXT,
  payment_type TEXT,
  phone_payment TEXT,
  created_at TIMESTAMPTZ,
  clients JSON,
  plans JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM search_payments_with_filters(search_term => search_term);
END;
$$ LANGUAGE plpgsql;
