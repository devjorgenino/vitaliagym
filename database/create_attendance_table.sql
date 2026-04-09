-- Crear tabla de asistencias
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIME DEFAULT NULL,
  check_out_time TIME DEFAULT NULL,
  status TEXT DEFAULT 'present', -- present, absent, late
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- Crear políticas para la tabla de asistencias
CREATE POLICY "Users can view attendance" ON attendance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert attendance" ON attendance
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update attendance" ON attendance
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete attendance" ON attendance
  FOR DELETE USING (auth.role() = 'authenticated');

-- Habilitar RLS (Row Level Security)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Crear trigger para updated_at automáticamente
CREATE TRIGGER handle_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_attendance_client_id ON attendance(client_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);