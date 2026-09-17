-- Script para crear la tabla configuracion_sistema y registrar las configuraciones
CREATE TABLE IF NOT EXISTS public.configuracion_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura configuracion" 
ON public.configuracion_sistema FOR SELECT USING (true);

CREATE POLICY "Escritura configuracion" 
ON public.configuracion_sistema FOR ALL USING (true);
