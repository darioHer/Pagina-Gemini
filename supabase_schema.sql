-- ============================================================================
-- SCHEMA BASE DE DATOS SUPABASE - ALCALDÍA MUNICIPAL (PROJECT: wdixodwaagkjzcvbtxhg)
-- Incluye: Usuarios, Roles, Verificación de Duplicados, PQRS y Búsqueda Semántica
-- Ejecutar en: https://supabase.com/dashboard/project/wdixodwaagkjzcvbtxhg/sql/new
-- ============================================================================

-- 1. Habilitar la extensión de vectores para búsqueda semántica (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA DE ROLES MUNICIPALES Y DE SISTEMA
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  permisos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar roles iniciales y requeridos
INSERT INTO roles (id, nombre, descripcion, permisos) VALUES
  ('admin', 'Administrador', 'Administrador con acceso total a la gestión de usuarios, roles, permisos y configuración del sistema.', ARRAY['admin_total', 'gestionar_usuarios', 'gestionar_roles', 'gestionar_permisos', 'ver_todos_radicados', 'radicar_pqr']),
  ('gobernanza', 'Gobernanza', 'Responsable de gobernanza, normativas institucionales y políticas públicas.', ARRAY['gobernar_normativas', 'ver_todos_radicados', 'radicar_pqr']),
  ('revisor', 'Revisor / Validador', 'Servidor público encargado de revisar, validar y autorizar borradores de respuestas PQRS.', ARRAY['revisar_radicados', 'aprobar_radicados', 'ver_todos_radicados', 'responder_pqr', 'radicar_pqr']),
  ('usuario_normal', 'Usuario Normal', 'Ciudadano o usuario general que puede registrarse, radicar peticiones y consultar sus trámites.', ARRAY['radicar_pqr', 'ver_mis_radicados']),
  -- Roles legacy para retrocompatibilidad
  ('ciudadano', 'Ciudadano General (Legacy)', 'Usuario registrado general.', ARRAY['radicar_pqr', 'ver_mis_radicados']),
  ('funcionario_alcaldia', 'Funcionario de Atención (Legacy)', 'Servidor público municipal.', ARRAY['radicar_pqr', 'ver_todos_radicados', 'responder_pqr']),
  ('analista_pqrs', 'Analista Técnico (Legacy)', 'Técnico especialista.', ARRAY['ver_todos_radicados', 'clasificar_pqr', 'responder_pqr']),
  ('admin_municipal', 'Administrador Municipal (Legacy)', 'Administrador del portal.', ARRAY['admin_total', 'gestionar_usuarios', 'gestionar_roles'])
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  permisos = EXCLUDED.permisos;

-- 3. TABLA DE USUARIOS (Sincronizada con Supabase Auth)
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  avatar TEXT,
  cedula TEXT,
  telefono TEXT,
  role_id TEXT REFERENCES roles(id) DEFAULT 'usuario_normal',
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  google_sub_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que el campo estado exista si la tabla ya fue creada
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo'));


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

-- 13. FUNCIÓN DE NIVELES DE PERMISOS PARA RLS
CREATE OR REPLACE FUNCTION public.es_administrador(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role_id INTO v_role FROM public.usuarios WHERE id = p_user_id;
  RETURN v_role IN ('admin', 'admin_municipal');
END;
$$;

-- 14. POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY - RLS)

-- Roles: lectura pública para usuarios autenticados y anónimos, modificación solo para administradores
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de roles a todos" ON roles;
CREATE POLICY "Permitir lectura de roles a todos" ON roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificar roles solo a admins" ON roles;
CREATE POLICY "Permitir modificar roles solo a admins" ON roles 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Categorías: lectura pública
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de categorias a todos" ON categorias;
CREATE POLICY "Permitir lectura de categorias a todos" ON categorias FOR SELECT USING (true);

-- Normativas y políticas: lectura pública para el buscador y consultas
ALTER TABLE normativas_politicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de normativas a todos" ON normativas_politicas;
CREATE POLICY "Permitir lectura de normativas a todos" ON normativas_politicas FOR SELECT USING (true);

-- Usuarios: permitir lectura de perfiles a todos los autenticados; sincronización propia e inserción
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

-- 15. TABLA DE CONFIGURACIÓN DEL SISTEMA IA (GEMINI / GROQ)
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id TEXT PRIMARY KEY,
  clave TEXT UNIQUE NOT NULL,
  valor JSONB NOT NULL,
  updated_by TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuración inicial predeterminada de IA
INSERT INTO configuracion_sistema (id, clave, valor) VALUES
  (
    'config_ia_global',
    'ia_config',
    '{
      "geminiModel": "gemini-1.5-flash",
      "groqModel": "llama-3.3-70b-versatile",
      "temperature": 0.3,
      "maxTokens": 2048,
      "systemPrompt": "Eres un asistente oficial de la Alcaldía Municipal especializado en normativas locales y atención ciudadana. Responde con lenguaje institucional, formal y jurídicamente preciso citando las normativas proporcionadas."
    }'::jsonb
  )
ON CONFLICT (clave) DO NOTHING;

-- RLS para configuracion_sistema: Lectura pública/autenticada, modificación permitida a admins
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de configuracion a todos" ON configuracion_sistema;
CREATE POLICY "Permitir lectura de configuracion a todos" ON configuracion_sistema FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificar configuracion" ON configuracion_sistema;
CREATE POLICY "Permitir modificar configuracion" ON configuracion_sistema FOR ALL USING (true) WITH CHECK (true);

-- 16. TABLA DE AUDITORÍA E HISTORIAL DE ACCIONES ADMINISTRATIVAS
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT,
  usuario_nombre TEXT,
  accion TEXT NOT NULL,
  elemento_modificado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para auditoria: Lectura pública/autenticada, registro permitido
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de auditoria a todos" ON auditoria;
CREATE POLICY "Permitir lectura de auditoria a todos" ON auditoria FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir registrar auditoria" ON auditoria;
CREATE POLICY "Permitir registrar auditoria" ON auditoria FOR INSERT WITH CHECK (true);

-- 17. TABLA DE DOCUMENTOS Y PROCESAMIENTO OCR CON GEMINI
CREATE TABLE IF NOT EXISTS documentos_ocr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT,
  usuario_email TEXT,
  nombre_archivo TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamano_bytes BIGINT NOT NULL,
  url_archivo TEXT,
  estado_ocr TEXT DEFAULT 'RECIBIDO' CHECK (estado_ocr IN ('RECIBIDO', 'OCR_EN_PROCESO', 'OCR_COMPLETADO', 'OCR_ERROR')),
  resultado_json JSONB,
  texto_extraido TEXT,
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

-- 13. FUNCIÓN DE NIVELES DE PERMISOS PARA RLS
CREATE OR REPLACE FUNCTION public.es_administrador(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role_id INTO v_role FROM public.usuarios WHERE id = p_user_id;
  RETURN v_role IN ('admin', 'admin_municipal');
END;
$$;

-- 14. POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY - RLS)

-- Roles: lectura pública para usuarios autenticados y anónimos, modificación solo para administradores
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de roles a todos" ON roles;
CREATE POLICY "Permitir lectura de roles a todos" ON roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificar roles solo a admins" ON roles;
CREATE POLICY "Permitir modificar roles solo a admins" ON roles 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Categorías: lectura pública
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de categorias a todos" ON categorias;
CREATE POLICY "Permitir lectura de categorias a todos" ON categorias FOR SELECT USING (true);

-- Normativas y políticas: lectura pública para el buscador y consultas
ALTER TABLE normativas_politicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de normativas a todos" ON normativas_politicas;
CREATE POLICY "Permitir lectura de normativas a todos" ON normativas_politicas FOR SELECT USING (true);

-- Usuarios: permitir lectura de perfiles a todos los autenticados; sincronización propia e inserción
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

-- 15. TABLA DE CONFIGURACIÓN DEL SISTEMA IA (GEMINI / GROQ)
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id TEXT PRIMARY KEY,
  clave TEXT UNIQUE NOT NULL,
  valor JSONB NOT NULL,
  updated_by TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuración inicial predeterminada de IA
INSERT INTO configuracion_sistema (id, clave, valor) VALUES
  (
    'config_ia_global',
    'ia_config',
    '{
      "geminiModel": "gemini-1.5-flash",
      "groqModel": "llama-3.3-70b-versatile",
      "temperature": 0.3,
      "maxTokens": 2048,
      "systemPrompt": "Eres un asistente oficial de la Alcaldía Municipal especializado en normativas locales y atención ciudadana. Responde con lenguaje institucional, formal y jurídicamente preciso citando las normativas proporcionadas."
    }'::jsonb
  )
ON CONFLICT (clave) DO NOTHING;

-- RLS para configuracion_sistema: Lectura pública/autenticada, modificación permitida a admins
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de configuracion a todos" ON configuracion_sistema;
CREATE POLICY "Permitir lectura de configuracion a todos" ON configuracion_sistema FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificar configuracion" ON configuracion_sistema;
CREATE POLICY "Permitir modificar configuracion" ON configuracion_sistema FOR ALL USING (true) WITH CHECK (true);

-- 16. TABLA DE AUDITORÍA E HISTORIAL DE ACCIONES ADMINISTRATIVAS
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT,
  usuario_nombre TEXT,
  accion TEXT NOT NULL,
  elemento_modificado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para auditoria: Lectura pública/autenticada, registro permitido
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de auditoria a todos" ON auditoria;
CREATE POLICY "Permitir lectura de auditoria a todos" ON auditoria FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir registrar auditoria" ON auditoria;
CREATE POLICY "Permitir registrar auditoria" ON auditoria FOR INSERT WITH CHECK (true);

-- 17. TABLA DE DOCUMENTOS Y PROCESAMIENTO OCR CON GEMINI
CREATE TABLE IF NOT EXISTS documentos_ocr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT,
  usuario_email TEXT,
  nombre_archivo TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamano_bytes BIGINT NOT NULL,
  url_archivo TEXT,
  estado_ocr TEXT DEFAULT 'RECIBIDO' CHECK (estado_ocr IN ('RECIBIDO', 'OCR_EN_PROCESO', 'OCR_COMPLETADO', 'OCR_ERROR')),
  resultado_json JSONB,
  texto_extraido TEXT,
  error_mensaje TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para documentos_ocr
ALTER TABLE documentos_ocr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de documentos_ocr a todos" ON documentos_ocr;
CREATE POLICY "Permitir lectura de documentos_ocr a todos" ON documentos_ocr FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insertar documentos_ocr" ON documentos_ocr;
CREATE POLICY "Permitir insertar documentos_ocr" ON documentos_ocr FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizar documentos_ocr" ON documentos_ocr;
CREATE POLICY "Permitir actualizar documentos_ocr" ON documentos_ocr FOR UPDATE USING (true);

-- 18. ESTRUCTURA AMPLIADA DE NORMATIVAS MUNICIPALES
ALTER TABLE normativas_politicas
  ADD COLUMN IF NOT EXISTS tipo_norma TEXT DEFAULT 'Decretos',
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS anio INTEGER DEFAULT 2024,
  ADD COLUMN IF NOT EXISTS entidad TEXT DEFAULT 'Alcaldía Municipal',
  ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS articulos TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Vigente' CHECK (estado IN ('Vigente', 'Derogada', 'Modificada')),
  ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ DEFAULT NOW();

-- 19. TABLA DE BORRADORES DE RESPUESTA (GENERACIÓN GROQ RAG)
CREATE TABLE IF NOT EXISTS borradores_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radicado_id TEXT,
  usuario_id TEXT,
  usuario_email TEXT,
  modelo_utilizado TEXT NOT NULL,
  normativa_utilizada JSONB,
  prompt_configuracion JSONB,
  respuesta_borrador TEXT NOT NULL,
  estado TEXT DEFAULT 'BORRADOR_GENERADO' CHECK (estado IN ('CONSULTANDO_NORMATIVA', 'BORRADOR_GENERADO', 'BORRADOR', 'EN_REVISION')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para borradores_respuestas
ALTER TABLE borradores_respuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de borradores a todos" ON borradores_respuestas;
CREATE POLICY "Permitir lectura de borradores a todos" ON borradores_respuestas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insertar borradores" ON borradores_respuestas;
CREATE POLICY "Permitir insertar borradores" ON borradores_respuestas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizar borradores" ON borradores_respuestas;
CREATE POLICY "Permitir actualizar borradores" ON borradores_respuestas FOR UPDATE USING (true);

-- 20. HISTORIAL INMUTABLE DE VERSIONES DE RESPUESTAS OFICIALES (FASE 6)
CREATE TABLE IF NOT EXISTS versiones_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radicado_id TEXT NOT NULL,
  version_numero INTEGER NOT NULL DEFAULT 1,
  respuesta_texto TEXT NOT NULL,
  modificado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  modificado_por_nombre TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para versiones_respuestas (Lectura general, creación solo por personal autorizado)
ALTER TABLE versiones_respuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de versiones a todos" ON versiones_respuestas;
CREATE POLICY "Permitir lectura de versiones a todos" ON versiones_respuestas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir crear versiones de respuesta" ON versiones_respuestas;
CREATE POLICY "Permitir crear versiones de respuesta" ON versiones_respuestas FOR INSERT WITH CHECK (true);

-- 21. HISTORIAL Y TRAZABILIDAD DE CAMBIOS DE ESTADO DE RADICADOS
CREATE TABLE IF NOT EXISTS historial_estados_radicado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radicado_id TEXT NOT NULL,
  estado_anterior TEXT NOT NULL,
  estado_nuevo TEXT NOT NULL,
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre TEXT,
  observacion TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para historial_estados_radicado
ALTER TABLE historial_estados_radicado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de historial de estados" ON historial_estados_radicado;
CREATE POLICY "Permitir lectura de historial de estados" ON historial_estados_radicado FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir registrar cambio de estado" ON historial_estados_radicado;
CREATE POLICY "Permitir registrar cambio de estado" ON historial_estados_radicado FOR INSERT WITH CHECK (true);

-- 22. FUNCIÓN PL/PGSQL PARA VALIDACIÓN DE PERMISOS DE APROBACIÓN EN BACKEND RLS
CREATE OR REPLACE FUNCTION public.puede_aprobar_respuestas(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_permisos TEXT[];
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  
  SELECT u.role_id, r.permisos INTO v_role, v_permisos 
  FROM public.usuarios u 
  LEFT JOIN public.roles r ON u.role_id = r.id 
  WHERE u.id = p_user_id;

  -- Solo administradores, revisores o usuarios con el permiso 'aprobar_radicados' pueden aprobar
  RETURN (
    v_role IN ('admin', 'admin_municipal', 'revisor') 
    OR 'aprobar_radicados' = ANY(v_permisos)
    OR 'admin_total' = ANY(v_permisos)
  );
END;
$$;

