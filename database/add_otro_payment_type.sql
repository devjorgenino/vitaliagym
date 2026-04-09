-- Migracion para agregar el tipo de pago 'otro' y campo 'payment_detail'
-- Ejecutar este script en la base de datos existente

-- 1. Primero eliminamos el constraint existente de payment_type
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;

-- 2. Creamos el nuevo constraint con el tipo 'otro' adicional
ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check 
  CHECK (payment_type IN ('pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_dolares', 'efectivo_bolivares', 'otro'));

-- 3. Agregamos el campo payment_detail para almacenar el detalle cuando el tipo es 'otro'
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_detail TEXT;

-- 4. Agregar un comentario para documentar el campo
COMMENT ON COLUMN payments.payment_detail IS 'Detalle del metodo de pago cuando payment_type es otro (ej: Zelle, PayPal, criptomoneda, etc.)';

-- Verificar que los cambios se aplicaron correctamente
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_detail';
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'payments_payment_type_check';
