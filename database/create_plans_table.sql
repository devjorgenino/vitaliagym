-- Crear tabla planes para gestionar planes del gimnasio
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear políticas para la tabla planes
CREATE POLICY "Users can view all plans" ON plans
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert plans" ON plans
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own plans" ON plans
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete plans" ON plans
  FOR DELETE USING (auth.role() = 'authenticated');

-- Habilitar RLS (Row Level Security)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER handle_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();