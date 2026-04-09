-- Crear tabla clientes para gestionar clientes del gimnasio
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  cedula TEXT UNIQUE NOT NULL,
  birth_date DATE NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  observations TEXT,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  join_date DATE DEFAULT CURRENT_DATE,
  next_payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear políticas para la tabla clientes
CREATE POLICY "Users can view all clients" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert clients" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update clients" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete clients" ON clients
  FOR DELETE USING (auth.role() = 'authenticated');

-- Habilitar RLS (Row Level Security)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER handle_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_clients_plan_id ON clients(plan_id);
CREATE INDEX IF NOT EXISTS idx_clients_cedula ON clients(cedula);
CREATE INDEX IF NOT EXISTS idx_clients_join_date ON clients(join_date);
CREATE INDEX IF NOT EXISTS idx_clients_next_payment ON clients(next_payment_date);