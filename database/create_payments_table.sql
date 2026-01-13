-- Crear tabla pagos para gestionar pagos de los planes de clientes
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  amount_usd DECIMAL(10, 2) NOT NULL,
  amount_bs DECIMAL(15, 2) NOT NULL,
  exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 1.0000,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  bank TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_dolares')),
  phone_payment TEXT, -- Solo para pago móvil
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear políticas para la tabla pagos
CREATE POLICY "Users can view all payments" ON payments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert payments" ON payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update payments" ON payments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete payments" ON payments
  FOR DELETE USING (auth.role() = 'authenticated');

-- Habilitar RLS (Row Level Security)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER handle_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_bank ON payments(bank);

-- Crear índices compuestos para consultas comunes
CREATE INDEX IF NOT EXISTS idx_payments_client_date ON payments(client_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type_date ON payments(payment_type, payment_date);