"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SystemDiagnostic = () => {
  const [showSql, setShowSql] = useState(false);

  const sqlScript = `
-- Copia y ejecuta este script en Supabase Dashboard → SQL Editor

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

-- Habilitar RLS y políticas
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON plans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON attendance FOR ALL USING (auth.role() = 'authenticated');

-- Datos de ejemplo
INSERT INTO plans (name, description, price, duration_days) VALUES
('Plan Básico', 'Acceso básico', 29.99, 30),
('Plan Premium', 'Acceso completo', 49.99, 30)
ON CONFLICT DO NOTHING;`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 Configuración del Sistema
            <Badge variant="outline">VitaliaGym</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 Pasos para configurar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">1</span>
                  <span>Ve a tu <strong>Supabase Dashboard</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">2</span>
                  <span>Navega a <strong>SQL Editor</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">3</span>
                  <span>Copia y ejecuta el script de abajo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">4</span>
                  <span>Refresca tu aplicación</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔍 Verificar configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => setShowSql(!showSql)} 
                  className="w-full"
                >
                  {showSql ? 'Ocultar' : 'Mostrar'} Script SQL
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open('/config', '_blank')}
                >
                  Verificar Estado del Sistema
                </Button>
                <div className="text-sm text-gray-600">
                  <p>✅ Después de ejecutar el script:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Planes carguen correctamente</li>
                    <li>Podrás agregar clientes</li>
                    <li>El sistema funcionará completamente</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {showSql && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📝 Script SQL para Supabase</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{sqlScript}</code>
                  </pre>
                  <Button
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => navigator.clipboard.writeText(sqlScript)}
                  >
                    📋 Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⚠️ Problemas Comunes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-red-50 rounded border-l-4 border-red-500">
                  <strong>Error "relation does not exist":</strong>
                  <p className="mt-1">Las tablas no están creadas. Ejecuta el script SQL.</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-500">
                  <strong>Error "Failed to fetch":</strong>
                  <p className="mt-1">Verifica tu conexión a internet y variables de entorno.</p>
                </div>
                <div className="p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                  <strong>Error CORS:</strong>
                  <p className="mt-1">Agrega http://localhost:3000 en Supabase → Settings → API → CORS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemDiagnostic;