-- Migración para agregar el tipo de pago 'efectivo_bolivares'
-- Ejecutar este script en la base de datos existente

-- Primero eliminamos el constraint existente
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;

-- Luego creamos el nuevo constraint con el tipo adicional
ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check 
  CHECK (payment_type IN ('pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_dolares', 'efectivo_bolivares'));

-- Verificar que el constraint se aplicó correctamente
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'payments_payment_type_check';
