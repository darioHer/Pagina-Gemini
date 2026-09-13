-- ============================================================================
-- SCHEMA BASE DE DATOS SUPABASE - ALCALDÍA MUNICIPAL (PROJECT: wdixodwaagkjzcvbtxhg)
-- Incluye: Usuarios, Roles, Verificación de Duplicados, PQRS y Búsqueda Semántica
-- Ejecutar en: https://supabase.com/dashboard/project/wdixodwaagkjzcvbtxhg/sql/new
-- ============================================================================

-- 1. Habilitar la extensión de vectores para búsqueda semántica (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA DE ROLES MUNICIPALES
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  permisos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar roles por defecto
INSERT INTO roles (id, nombre, descripcion, permisos) VALUES
  ('ciudadano', 'Ciudadano General', 'Usuario registrado con cuenta de Google que puede radicar peticiones y consultar sus trámites.', ARRAY['radicar_pqr', 'ver_mis_radicados']),
  ('funcionario_alcaldia', 'Funcionario de Atención Ciudadana', 'Servidor público municipal encargado de revisar y responder radicados PQRS.', ARRAY['radicar_pqr', 'ver_todos_radicados', 'responder_pqr']),
  ('analista_pqrs', 'Analista Técnico de Servicios', 'Técnico especialista asignado a responder temas de agua, basura o alumbrado.', ARRAY['ver_todos_radicados', 'clasificar_pqr', 'responder_pqr']),
  ('admin_municipal', 'Administrador del Portal', 'Administrador con acceso total a gestión de normativas, usuarios y políticas.', ARRAY['admin_total'])
ON CONFLICT (id) DO NOTHING;

-- 3. TABLA DE USUARIOS DE GOOGLE
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  avatar TEXT,
  cedula TEXT,
  telefono TEXT,
  role_id TEXT REFERENCES roles(id) DEFAULT 'ciudadano',
  google_sub_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE PETICIONES Y SOLICITUDES PQRS (CON VERIFICACIÓN DE DUPLICADOS)
CREATE TABLE IF NOT EXISTS peticiones_pqrs (
  id TEXT PRIMARY KEY,
  solicitante TEXT NOT NULL,
  email_solicitante TEXT NOT NULL,
  cedula_solicitante TEXT NOT NULL,
  telefono_solicitante TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo_solicitud TEXT NOT NULL,
  modo_radicacion TEXT NOT NULL,
  asunto TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  archivo_adjunto JSONB,
  estado TEXT DEFAULT 'En trámite',
  fecha_radicacion TIMESTAMPTZ DEFAULT NOW(),
  plazo_legal TEXT DEFAULT '15 días hábiles',
  respuesta_oficial TEXT DEFAULT 'Solicitud asignada a la dependencia municipal correspondiente.',
  hash_seguridad TEXT UNIQUE NOT NULL,
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice Único para Prevenir Documentos/Asuntos Duplicados por Cédula
CREATE UNIQUE INDEX IF NOT EXISTS idx_peticiones_duplicadas 
ON peticiones_pqrs (LOWER(cedula_solicitante), LOWER(asunto));

-- 5. TABLA DE NORMATIVAS Y POLÍTICAS DE LA ALCALDÍA (BÚSQUEDA SEMÁNTICA VECTORIAL)
CREATE TABLE IF NOT EXISTS normativas_politicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  articulo_referencia TEXT NOT NULL,
  contenido TEXT NOT NULL,
  resumen_ejecutivo TEXT NOT NULL,
  entidad_emisora TEXT DEFAULT 'Alcaldía Municipal',
  fecha_publicacion DATE DEFAULT CURRENT_DATE,
  embedding vector(1536) -- Vector para búsqueda semántica con IA / pgvector
);

-- Index para acelerar la búsqueda por similitud de coseno en pgvector
CREATE INDEX IF NOT EXISTS idx_normativas_embedding 
ON normativas_politicas USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 6. FUNCIÓN RPC DE BÚSQUEDA SEMÁNTICA EN SUPABASE
CREATE OR REPLACE FUNCTION match_normativas (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 5,
  filter_categoria text DEFAULT 'Todas'
)
RETURNS TABLE (
  id UUID,
  titulo TEXT,
  categoria TEXT,
  articulo_referencia TEXT,
  contenido TEXT,
  resumen_ejecutivo TEXT,
  entidad_emisora TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    normativas_politicas.id,
    normativas_politicas.titulo,
    normativas_politicas.categoria,
    normativas_politicas.articulo_referencia,
    normativas_politicas.contenido,
    normativas_politicas.resumen_ejecutivo,
    normativas_politicas.entidad_emisora,
    1 - (normativas_politicas.embedding <=> query_embedding) AS similarity
  FROM normativas_politicas
  WHERE 
    (filter_categoria = 'Todas' OR normativas_politicas.categoria = filter_categoria)
    AND 1 - (normativas_politicas.embedding <=> query_embedding) > match_threshold
  ORDER BY normativas_politicas.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. FUNCIÓN ALMACENADA PARA VERIFICAR SI UN DOCUMENTO O ASUNTO ES DUPLICADO
CREATE OR REPLACE FUNCTION verificar_duplicado_pqrs(
  p_cedula TEXT,
  p_asunto TEXT,
  p_hash TEXT
)
RETURNS TABLE (
  es_duplicado BOOLEAN,
  radicado_existente_id TEXT,
  motivo TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_found_id TEXT;
BEGIN
  -- 1. Verificar por hash exacto del archivo/documento
  SELECT id INTO v_found_id FROM peticiones_pqrs WHERE hash_seguridad = p_hash LIMIT 1;
  IF v_found_id IS NOT NULL THEN
    RETURN QUERY SELECT TRUE, v_found_id, 'El archivo adjunto ya ha sido radicado anteriormente (coincidencia exacta de firma digital)';
    RETURN;
  END IF;

  -- 2. Verificar por cédula y asunto similar
  SELECT id INTO v_found_id FROM peticiones_pqrs 
  WHERE LOWER(cedula_solicitante) = LOWER(p_cedula) 
    AND LOWER(asunto) = LOWER(p_asunto)
  LIMIT 1;

  IF v_found_id IS NOT NULL THEN
    RETURN QUERY SELECT TRUE, v_found_id, 'Ya existe una petición previa registrada por este número de cédula con el mismo asunto';
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, NULL::TEXT, 'Sin duplicados detectados';
END;
$$;

-- 8. NORMATIVAS Y POLÍTICAS INICIALES DE LA ALCALDÍA
INSERT INTO normativas_politicas (titulo, categoria, articulo_referencia, contenido, resumen_ejecutivo, entidad_emisora)
VALUES
  (
    'Reglamento de Términos para el Derecho de Petición y PQRS',
    'Derecho de Petición',
    'Decreto Municipal 042 de 2024 - Art. 14',
    'Toda petición presentada por los ciudadanos ante la Alcaldía Municipal deberá ser resuelta dentro de los 15 días hábiles siguientes a su recepción. Las solicitudes de información o copia de documentos deberán resolverse en un plazo máximo de 10 días hábiles. En caso de no poder responder en el plazo fijado, la autoridad deberá informar al interesado antes del vencimiento.',
    'Establece el plazo máximo legal de 15 días para Peticiones Generales y 10 días para solicitudes de copia de documentos públicos.',
    'Alcaldía Municipal'
  ),
  (
    'Estatuto de Protección al Usuario de Agua Potable y Alcantarillado',
    'Agua y Alcantarillado',
    'Acuerdo Municipal 112 - Art. 8 y 22',
    'La empresa municipal de servicios públicos debe garantizar el suministro continuo de agua potable. Ante reportes de fugas en la red principal o suspensión no programada del servicio, las cuadrillas técnicas deben hacer presencia en un plazo máximo no superior a 24 horas y restablecer el flujo.',
    'Regula la atención prioritaria a fugas de agua y la obligación de presencia técnica municipal en menos de 24 horas.',
    'Concejo y Alcaldía Municipal'
  ),
  (
    'Política de Gestión Integral de Residuos Sólidos y Limpia Pública',
    'Recolección de Basura',
    'Resolución de Secretaría de Salud 089 - Art. 5',
    'Queda estrictamente prohibido el depósito de escombros, muebles o residuos vegetales en esquinas y parajes públicos. Las rutas de recolección de basura domiciliaria deben cumplir los horarios estipulados. La acumulación no autorizada dará lugar a operativos de limpia obligatoria en 48 horas.',
    'Prohíbe puntos críticos de basura y obliga a la alcaldía a operativos de recolección especial ante acumulación inusual.',
    'Secretaría de Medio Ambiente'
  ),
  (
    'Manual de Mantenimiento y Modernización del Alumbrado Público LED',
    'Alumbrado Público',
    'Decreto de Infraestructura 204 - Art. 3',
    'Los reportes de luminarias apagadas en vías principales, parques o complejos deportivos deben atenderse prioritariamente en un plazo de 5 a 10 días hábiles. Las fallas que representen riesgo estructural o postes inclinados se catalogan como emergencias nivel 1 con intervención en 72 horas.',
    'Define tiempos de sustitución de fotoceldas LED y atención prioritaria a postes con riesgo estructural.',
    'Secretaría de Obras Públicas'
  ),
  (
    'Ley de Transparencia, Acceso a la Información y Habeas Data',
    'Derecho de Petición',
    'Ley Estatutaria 1712 - Art. 6',
    'Los datos personales recopilados durante la radicación electrónica de peticiones sólo podrán usarse para notificaciones administrativas y seguimiento del trámite. Todo ciudadano tiene derecho a actualizar, rectificar o suprimir sus datos del sistema municipal.',
    'Protección de datos personales (Habeas Data) y garantía del libre acceso a la información pública municipal.',
    'Gobierno Nacional y Alcaldía'
  ),
  (
    'Código de Tránsito y Movilidad en Vías Municipales',
    'Tránsito y Movilidad',
    'Acuerdo Municipal 078 - Art. 45',
    'Toda intervención o hueco en la malla vial que represente peligro a la circulación de vehículos o peatones debe ser reportado mediante radicado PQRS para su señalización e inclusión en el plan de bacheo municipal.',
    'Norma para el reporte de daños viales y atención por parte de la Secretaría de Movilidad.',
    'Secretaría de Tránsito y Movilidad'
  )
ON CONFLICT DO NOTHING;

-- 9. TABLA MAESTRA DE CATEGORÍAS MUNICIPALES (CONECTA PETICIONES Y NORMATIVAS)
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categorias (id, nombre, descripcion) VALUES
  ('derecho_peticion', 'Derecho de Petición', 'Peticiones generales, quejas y acceso a información.'),
  ('agua_alcantarillado', 'Agua y Alcantarillado', 'Reportes de acueducto, fugas y suministro.'),
  ('recoleccion_basura', 'Recolección de Basura', 'Limpia pública, escombros y rutas de aseo.'),
  ('alumbrado_publico', 'Alumbrado Público', 'Luminarias LED, postes y fallas eléctricas.'),
  ('transito_movilidad', 'Tránsito y Movilidad', 'Malla vial, reductores y señalización.')
ON CONFLICT (id) DO NOTHING;

-- 10. RELACIONAR normativas_politicas CON categorias Y usuarios
ALTER TABLE normativas_politicas 
  ADD COLUMN IF NOT EXISTS categoria_id TEXT REFERENCES categorias(id),
  ADD COLUMN IF NOT EXISTS publicado_por_id TEXT REFERENCES usuarios(id);

-- 11. RELACIONAR peticiones_pqrs CON categorias, normativas Y funcionarios
ALTER TABLE peticiones_pqrs
  ADD COLUMN IF NOT EXISTS categoria_id TEXT REFERENCES categorias(id),
  ADD COLUMN IF NOT EXISTS normativa_aplicable_id UUID REFERENCES normativas_politicas(id),
  ADD COLUMN IF NOT EXISTS funcionario_asignado_id TEXT REFERENCES usuarios(id);

-- 12. TABLA RELACIONAL DE RESPUESTAS Y TRAZABILIDAD (1:N)
CREATE TABLE IF NOT EXISTS respuestas_pqrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peticion_id TEXT NOT NULL REFERENCES peticiones_pqrs(id) ON DELETE CASCADE,
  funcionario_id TEXT REFERENCES usuarios(id),
  normativa_citada_id UUID REFERENCES normativas_politicas(id),
  estado_nuevo TEXT DEFAULT 'En trámite',
  respuesta_texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY - RLS)

-- Roles: lectura pública para todos
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de roles a todos" ON roles;
CREATE POLICY "Permitir lectura de roles a todos" ON roles FOR SELECT USING (true);

-- Categorías: lectura pública
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de categorias a todos" ON categorias;
CREATE POLICY "Permitir lectura de categorias a todos" ON categorias FOR SELECT USING (true);

-- Normativas y políticas: lectura pública para el buscador y consultas
ALTER TABLE normativas_politicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de normativas a todos" ON normativas_politicas;
CREATE POLICY "Permitir lectura de normativas a todos" ON normativas_politicas FOR SELECT USING (true);

-- Usuarios: permitir lectura y sincronización
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acceso a usuarios" ON usuarios;
CREATE POLICY "Permitir acceso a usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- Peticiones PQRS: permitir radicación (INSERT) y consulta pública por radicado o cédula (SELECT)
ALTER TABLE peticiones_pqrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir radicar peticiones" ON peticiones_pqrs;
CREATE POLICY "Permitir radicar peticiones" ON peticiones_pqrs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar peticiones" ON peticiones_pqrs;
CREATE POLICY "Permitir consultar peticiones" ON peticiones_pqrs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir actualizar peticiones" ON peticiones_pqrs;
CREATE POLICY "Permitir actualizar peticiones" ON peticiones_pqrs FOR UPDATE USING (true);

-- Respuestas PQRS: lectura y registro
ALTER TABLE respuestas_pqrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de respuestas a todos" ON respuestas_pqrs;
CREATE POLICY "Permitir lectura de respuestas a todos" ON respuestas_pqrs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir registrar respuestas" ON respuestas_pqrs;
CREATE POLICY "Permitir registrar respuestas" ON respuestas_pqrs FOR INSERT WITH CHECK (true);

