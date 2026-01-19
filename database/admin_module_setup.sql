-- =====================================================
-- MÓDULO ADMINISTRATIVO - VITALIAGYM
-- Script para crear tablas y permisos del módulo admin
-- =====================================================

-- 1. Tabla de Personal (Staff)
-- Almacena información de entrenadores, personal de limpieza, etc.
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  document_id VARCHAR(20), -- Cédula/DNI
  position VARCHAR(100) NOT NULL, -- Entrenador, Limpieza, Recepcionista, etc.
  department VARCHAR(100), -- Departamento
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  termination_date DATE,
  salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
  salary_type VARCHAR(20) DEFAULT 'monthly' CHECK (salary_type IN ('hourly', 'daily', 'weekly', 'biweekly', 'monthly')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  bank_account_type VARCHAR(20), -- Ahorro, Corriente
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para staff
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_position ON public.staff(position);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);

-- 2. Tabla de Pagos al Personal
CREATE TABLE IF NOT EXISTS public.staff_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_amount DECIMAL(10, 2) NOT NULL,
  bonus DECIMAL(10, 2) DEFAULT 0,
  deductions DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (base_amount + COALESCE(bonus, 0) - COALESCE(deductions, 0)) STORED,
  payment_method VARCHAR(50) DEFAULT 'transfer' CHECK (payment_method IN ('cash', 'transfer', 'check', 'mobile_payment')),
  payment_reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_staff_payments_staff_id ON public.staff_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_status ON public.staff_payments(status);
CREATE INDEX IF NOT EXISTS idx_staff_payments_date ON public.staff_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_staff_payments_period ON public.staff_payments(period_start, period_end);

-- 3. Tabla de Gastos Operativos
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL, -- Servicios, Mantenimiento, Suministros, etc.
  subcategory VARCHAR(100),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'cash',
  reference VARCHAR(100),
  vendor VARCHAR(200), -- Proveedor
  receipt_url TEXT, -- URL del recibo/factura
  recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(20), -- daily, weekly, monthly, yearly
  status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para gastos
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

-- 4. Categorías de Gastos (para mantener consistencia)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar categorías por defecto
INSERT INTO public.expense_categories (name, description, icon, color) VALUES
  ('Servicios', 'Agua, luz, internet, teléfono', 'Zap', 'blue'),
  ('Mantenimiento', 'Reparaciones y mantenimiento de equipos', 'Wrench', 'orange'),
  ('Suministros', 'Artículos de limpieza, oficina', 'Package', 'green'),
  ('Equipamiento', 'Compra de equipos de gimnasio', 'Dumbbell', 'purple'),
  ('Marketing', 'Publicidad y promociones', 'Megaphone', 'pink'),
  ('Alquiler', 'Renta del local', 'Building', 'gray'),
  ('Seguros', 'Pólizas de seguro', 'Shield', 'cyan'),
  ('Impuestos', 'Impuestos y tasas', 'Receipt', 'red'),
  ('Otros', 'Gastos varios', 'MoreHorizontal', 'slate')
ON CONFLICT (name) DO NOTHING;

-- 5. Posiciones de Personal (para mantener consistencia)
CREATE TABLE IF NOT EXISTS public.staff_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  base_salary DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar posiciones por defecto
INSERT INTO public.staff_positions (name, description, base_salary) VALUES
  ('Entrenador', 'Entrenador personal y de grupo', 0),
  ('Recepcionista', 'Atención al cliente y ventas', 0),
  ('Limpieza', 'Mantenimiento y limpieza', 0),
  ('Mantenimiento', 'Mantenimiento de equipos', 0),
  ('Nutricionista', 'Asesoría nutricional', 0),
  ('Fisioterapeuta', 'Terapia física y rehabilitación', 0),
  ('Coordinador', 'Coordinación de actividades', 0),
  ('Gerente', 'Gerencia general', 0)
ON CONFLICT (name) DO NOTHING;

-- 6. PERMISOS DEL MÓDULO ADMINISTRATIVO
-- Insertar permisos para el módulo admin
INSERT INTO public.permissions (code, name, description, module, action) VALUES
  -- Personal
  ('admin.view', 'Ver Administración', 'Permite acceder al módulo de administración', 'admin', 'view'),
  ('admin.staff.view', 'Ver Personal', 'Permite ver la lista de personal', 'admin', 'view'),
  ('admin.staff.create', 'Crear Personal', 'Permite registrar nuevo personal', 'admin', 'create'),
  ('admin.staff.edit', 'Editar Personal', 'Permite editar información del personal', 'admin', 'edit'),
  ('admin.staff.delete', 'Eliminar Personal', 'Permite eliminar registros de personal', 'admin', 'delete'),
  -- Pagos a personal
  ('admin.staff_payments.view', 'Ver Pagos de Personal', 'Permite ver pagos al personal', 'admin', 'view'),
  ('admin.staff_payments.create', 'Crear Pagos de Personal', 'Permite registrar pagos al personal', 'admin', 'create'),
  ('admin.staff_payments.edit', 'Editar Pagos de Personal', 'Permite editar pagos al personal', 'admin', 'edit'),
  ('admin.staff_payments.delete', 'Eliminar Pagos de Personal', 'Permite eliminar pagos al personal', 'admin', 'delete'),
  -- Gastos
  ('admin.expenses.view', 'Ver Gastos', 'Permite ver gastos operativos', 'admin', 'view'),
  ('admin.expenses.create', 'Crear Gastos', 'Permite registrar gastos', 'admin', 'create'),
  ('admin.expenses.edit', 'Editar Gastos', 'Permite editar gastos', 'admin', 'edit'),
  ('admin.expenses.delete', 'Eliminar Gastos', 'Permite eliminar gastos', 'admin', 'delete'),
  -- Reportes
  ('admin.reports.view', 'Ver Reportes', 'Permite ver y generar reportes', 'admin', 'view'),
  ('admin.reports.export', 'Exportar Reportes', 'Permite exportar reportes a PDF', 'admin', 'export')
ON CONFLICT (code) DO NOTHING;

-- 7. Asignar permisos admin al rol Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Admin' 
  AND p.module = 'admin'
ON CONFLICT DO NOTHING;

-- 8. Políticas RLS

-- Habilitar RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;

-- Políticas para staff (usando la función check_is_admin si existe)
CREATE POLICY "Admins can manage staff" ON public.staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

CREATE POLICY "Staff can view own record" ON public.staff
  FOR SELECT USING (user_id = auth.uid());

-- Políticas para staff_payments
CREATE POLICY "Admins can manage staff_payments" ON public.staff_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- Políticas para expenses
CREATE POLICY "Admins can manage expenses" ON public.expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- Políticas para categorías y posiciones (solo lectura para todos los autenticados)
CREATE POLICY "Authenticated users can view expense_categories" ON public.expense_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage expense_categories" ON public.expense_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

CREATE POLICY "Authenticated users can view staff_positions" ON public.staff_positions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage staff_positions" ON public.staff_positions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'Admin'
    )
  );

-- 9. Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_payments_updated_at ON public.staff_payments;
CREATE TRIGGER update_staff_payments_updated_at
  BEFORE UPDATE ON public.staff_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Vistas útiles para reportes

-- Vista de resumen de pagos por mes
CREATE OR REPLACE VIEW public.monthly_staff_payments_summary AS
SELECT 
  DATE_TRUNC('month', payment_date) as month,
  COUNT(*) as total_payments,
  COUNT(DISTINCT staff_id) as staff_count,
  SUM(total_amount) as total_paid,
  SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
  SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_amount
FROM public.staff_payments
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY month DESC;

-- Vista de resumen de gastos por categoría y mes
CREATE OR REPLACE VIEW public.monthly_expenses_summary AS
SELECT 
  DATE_TRUNC('month', expense_date) as month,
  category,
  COUNT(*) as expense_count,
  SUM(amount) as total_amount
FROM public.expenses
WHERE status = 'paid'
GROUP BY DATE_TRUNC('month', expense_date), category
ORDER BY month DESC, total_amount DESC;

-- Vista de personal activo con info de último pago
CREATE OR REPLACE VIEW public.staff_with_last_payment AS
SELECT 
  s.*,
  lp.last_payment_date,
  lp.last_payment_amount
FROM public.staff s
LEFT JOIN LATERAL (
  SELECT 
    payment_date as last_payment_date,
    total_amount as last_payment_amount
  FROM public.staff_payments sp
  WHERE sp.staff_id = s.id AND sp.status = 'paid'
  ORDER BY payment_date DESC
  LIMIT 1
) lp ON true
WHERE s.status = 'active';

COMMENT ON TABLE public.staff IS 'Personal del gimnasio (entrenadores, limpieza, etc.)';
COMMENT ON TABLE public.staff_payments IS 'Registro de pagos al personal';
COMMENT ON TABLE public.expenses IS 'Gastos operativos del gimnasio';
COMMENT ON TABLE public.expense_categories IS 'Categorías de gastos';
COMMENT ON TABLE public.staff_positions IS 'Posiciones/cargos del personal';
