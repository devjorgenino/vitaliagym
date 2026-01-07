-- Tablas básicas para el funcionamiento del sistema

-- Tabla plans
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  join_date DATE NOT NULL,
  next_payment_date DATE,
  plan_id UUID REFERENCES plans(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- Habilitar RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Políticas básicas
CREATE POLICY "Enable read access for all users" ON plans FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON plans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON plans FOR UPDATE WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON plans FOR DELETE WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON clients FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON clients FOR UPDATE WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON clients FOR DELETE WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON attendance FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON attendance FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON attendance FOR UPDATE WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON attendance FOR DELETE WITH CHECK (auth.role() = 'authenticated');

-- Insertar datos de ejemplo
INSERT INTO plans (name, description, price, duration_days) VALUES
('Plan Básico', 'Acceso básico al gimnasio', 29.99, 30),
('Plan Premium', 'Acceso completo + clases', 49.99, 30),
('Plan Elite', 'Acceso VIP + entrenador', 79.99, 30)
ON CONFLICT DO NOTHING;