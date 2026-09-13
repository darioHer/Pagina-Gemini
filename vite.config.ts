import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pqrs-mock-api-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // 1. PQRS JSON Fallback
          if (req.url === '/api/pqrs' || req.url?.startsWith('/api/pqrs?')) {
            try {
              const filePath = path.resolve(__dirname, 'data/pqrs.json');
              const fileData = fs.readFileSync(filePath, 'utf-8');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(fileData);
              return;
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Error al leer archivo de PQRS' }));
              return;
            }
          }

          // 2. OCR Gemini Middleware
          if (req.url === '/api/ocr' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body);
                const { fileName, mimeType, fileSizeBytes } = payload;
                
                const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
                const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
                const maxBytes = 10 * 1024 * 1024;
                const ext = fileName ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';

                if (!allowedExts.includes(ext)) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    estado_ocr: 'OCR_ERROR',
                    error: `Extensión de archivo inválida ('${ext}'). Extensiones permitidas: .png, .jpg, .jpeg, .webp, .pdf`
                  }));
                  return;
                }

                if (mimeType && !allowedMimes.includes(mimeType.toLowerCase())) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    estado_ocr: 'OCR_ERROR',
                    error: `Tipo MIME no permitido ('${mimeType}'). Tipos soportados: PNG, JPEG, WEBP, PDF`
                  }));
                  return;
                }

                if (fileSizeBytes > maxBytes) {
                  const sizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    estado_ocr: 'OCR_ERROR',
                    error: `El archivo excede el tamaño máximo permitido de 10 MB (Tamaño subido: ${sizeMb} MB)`
                  }));
                  return;
                }

                const mockExtraction = {
                  radicado: `RAD-${Date.now().toString().slice(-6)}`,
                  fecha: new Date().toISOString().split('T')[0],
                  entidad: 'Alcaldía Municipal - Servicio de OCR Gemini',
                  remitente: 'Ciudadano Solicitante',
                  destinatario: 'Secretaría Municipal Correspondiente',
                  asunto: `OCR extraído exitosamente de ${fileName}`,
                  peticion: `Se ha realizado el proceso de digitalización y lectura OCR sobre el archivo ${fileName}. El texto extraído se encuentra disponible para su revisión.`,
                  normas_mencionadas: ['Decreto Municipal 042 de 2024', 'Ley Estatutaria 1712 de Transparencia'],
                  fechas_importantes: [new Date().toISOString().split('T')[0]],
                  informacion_adicional: `Documento procesado correctamente (${mimeType}, ${(fileSizeBytes / 1024).toFixed(1)} KB).`,
                  texto_extraido: `[OCR GEMINI TRANSCRIPTION]\nArchivo: ${fileName}\nTipo MIME: ${mimeType}\nTamaño: ${(fileSizeBytes / 1024).toFixed(1)} KB\n\nPor medio de la presente, el ciudadano radica la solicitud formal número RAD-${Date.now().toString().slice(-6)} ante la Alcaldía Municipal.`
                };

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  id: `ocr-${Date.now()}`,
                  estado_ocr: 'OCR_COMPLETADO',
                  nombre_archivo: fileName,
                  tipo_mime: mimeType,
                  resultado_json: mockExtraction,
                  texto_extraido: mockExtraction.texto_extraido
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  estado_ocr: 'OCR_ERROR',
                  error: err?.message || 'Error al procesar la solicitud de OCR.'
                }));
              }
            });
            return;
          }

          // 3. Groq RAG Middleware
          if (req.url === '/api/groq-draft' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body);
                const { radicadoId, peticionData } = payload;
                const peticionText = `${peticionData?.asunto || ''} ${peticionData?.peticion || ''}`.toLowerCase();
                
                let normativas = [];
                if (peticionText.includes('agua') || peticionText.includes('acueducto') || peticionText.includes('tubería') || peticionText.includes('tuberia')) {
                  normativas.push({
                    id: 'norm-2',
                    titulo: 'Estatuto de Protección al Usuario de Agua Potable y Alcantarillado',
                    tipo_norma: 'Acuerdos',
                    numero: 'Acuerdo Municipal 112 - Art. 8 y 22'
                  });
                } else if (peticionText.includes('basura') || peticionText.includes('escombro') || peticionText.includes('limpia')) {
                  normativas.push({
                    id: 'norm-3',
                    titulo: 'Política de Gestión Integral de Residuos Sólidos y Limpia Pública',
                    tipo_norma: 'Resoluciones',
                    numero: 'Resolución de Secretaría de Salud 089 - Art. 5'
                  });
                } else if (peticionText.includes('alumbrado') || peticionText.includes('luminaria') || peticionText.includes('poste')) {
                  normativas.push({
                    id: 'norm-4',
                    titulo: 'Manual de Mantenimiento y Modernización del Alumbrado Público LED',
                    tipo_norma: 'Decretos',
                    numero: 'Decreto de Infraestructura 204 - Art. 3'
                  });
                } else if (!peticionText.includes('cohete') && !peticionText.includes('espacial')) {
                  normativas.push({
                    id: 'norm-1',
                    titulo: 'Reglamento de Términos para el Derecho de Petición y PQRS',
                    tipo_norma: 'Decretos',
                    numero: 'Decreto Municipal 042 de 2024 - Art. 14'
                  });
                }

                const radRef = radicadoId || peticionData?.radicado || `RAD-${Date.now().toString().slice(-6)}`;
                const remitenteRef = peticionData?.remitente || 'Ciudadano Solicitante';
                const asuntoRef = peticionData?.asunto || 'Petición Ciudadana';
                const peticionRef = peticionData?.peticion || 'Solicitud formal.';

                let draftText = '';
                if (normativas.length > 0) {
                  const n = normativas[0];
                  draftText = `ALCALDÍA MUNICIPAL DE ATENCIÓN CIUDADANA
RESPUESTA OFICIAL - ESTADO: BORRADOR

Radicado No.: ${radRef}
Fecha: ${new Date().toISOString().split('T')[0]}
Señor(a): ${remitenteRef}
Asunto: ${asuntoRef}

Respetado(a) ciudadano(a),

En atención a su petición con radicado No. ${radRef} en la cual manifiesta: "${peticionRef.slice(0, 160)}...", nos permitimos informarle que, de conformidad con la normativa municipal vigente recuperada desde Supabase:

De acuerdo con ${n.titulo} (${n.numero}), las cuadrillas técnicas y dependencias municipales están obligadas a hacer presencia e intervenir en los plazos legales establecidos.

En consecuencia, la administración municipal procederá a dar trámite e inspección a su solicitud.

Cordialmente,

DESPACHO DE ATENCIÓN CIUDADANA
Alcaldía Municipal
(DOCUMENTO EN ESTADO BORRADOR - REQUIERE VALIDACIÓN DE UN REVISOR)`;
                } else {
                  draftText = `ALCALDÍA MUNICIPAL DE ATENCIÓN CIUDADANA
RESPUESTA OFICIAL - ESTADO: BORRADOR

Radicado No.: ${radRef}
Fecha: ${new Date().toISOString().split('T')[0]}
Señor(a): ${remitenteRef}
Asunto: ${asuntoRef}

Respetado(a) ciudadano(a),

Revisada la base de datos de normativa municipal en Supabase para el asunto "${asuntoRef}", se informa que NO SE ENCONTRÓ INFORMACIÓN LEGAL O REGULATORIA SUFICIENTE para dar respuesta a esta solicitud en este momento.

La petición será escalada al área jurídica municipal para su revisión manual.

Cordialmente,

DESPACHO DE ATENCIÓN CIUDADANA
Alcaldía Municipal
(DOCUMENTO EN ESTADO BORRADOR - NORMATIVA INSUFICIENTE)`;
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  id: `borrador-${Date.now()}`,
                  estado: 'BORRADOR_GENERADO',
                  radicado_id: radRef,
                  modelo_utilizado: 'groq-llama-3.3-70b-versatile',
                  normativa_utilizada: normativas,
                  respuesta_borrador: draftText,
                  normativas_encontradas_count: normativas.length
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  estado: 'BORRADOR_ERROR',
                  error: err?.message || 'Error al procesar la solicitud de Borrador Groq.'
                }));
              }
            });
            return;
          }

          // 4. Cambiar Estado Radicado Middleware
          if (req.url === '/api/revision-respuestas/cambiar-estado' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body);
                const { radicadoId, estadoAnterior, estadoNuevo, userId, userNombre, observacion } = payload;

                if (estadoNuevo === 'APROBADO' || estadoNuevo === 'EMITIDO') {
                  const isUnauthorized = userId && (userId.includes('usuario_normal') || userId.includes('ciudadano'));
                  if (isUnauthorized) {
                    res.statusCode = 403;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      error: 'Permisos insuficientes. El rol de usuario normal no cuenta con autorización para validar o aprobar respuestas oficiales.'
                    }));
                    return;
                  }
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  radicado_id: radicadoId,
                  estado_anterior: estadoAnterior,
                  estado_nuevo: estadoNuevo,
                  usuario_id: userId,
                  usuario_nombre: userNombre,
                  fecha: new Date().toISOString(),
                  observacion: observacion
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Error al cambiar estado.' }));
              }
            });
            return;
          }

          // 5. Guardar Versión Middleware
          if (req.url === '/api/revision-respuestas/guardar-version' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body);
                const { radicadoId, respuestaTexto, userNombre, observaciones } = payload;
                const nextVer = 2;

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  mensaje: `Versión v${nextVer} registrada.`,
                  version: {
                    id: `ver-${Date.now()}`,
                    radicado_id: radicadoId,
                    version_numero: nextVer,
                    respuesta_texto: respuestaTexto,
                    modificado_por_nombre: userNombre || 'Revisor',
                    observaciones: observaciones || 'Versión guardada',
                    created_at: new Date().toISOString()
                  }
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Error al guardar versión.' }));
              }
            });
            return;
          }

          // 6. Consultar Historial Middleware
          if (req.url?.startsWith('/api/revision-respuestas/historial/')) {
            const radId = req.url.replace('/api/revision-respuestas/historial/', '');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              radicado_id: decodeURIComponent(radId),
              versiones: [
                {
                  id: 'v-102',
                  radicado_id: decodeURIComponent(radId),
                  version_numero: 2,
                  respuesta_texto: 'Respuesta v2 con precisiones normativas.',
                  modificado_por_nombre: 'Carlos Revisor (Revisor / Validador)',
                  observaciones: 'Ajuste del artículo 22 sobre plazos de atención técnica',
                  created_at: new Date().toISOString()
                },
                {
                  id: 'v-101',
                  radicado_id: decodeURIComponent(radId),
                  version_numero: 1,
                  respuesta_texto: 'Borrador inicial generado por Groq RAG.',
                  modificado_por_nombre: 'Sistema IA Groq',
                  observaciones: 'Borrador inicial',
                  created_at: new Date(Date.now() - 3600000).toISOString()
                }
              ],
              historial_estados: [
                {
                  id: 'h-202',
                  radicado_id: decodeURIComponent(radId),
                  estado_anterior: 'EN_REVISION',
                  estado_nuevo: 'APROBADO',
                  usuario_nombre: 'Carlos Revisor (Revisor / Validador)',
                  observacion: 'Respuesta validada y aprobada jurídicamente',
                  fecha: new Date().toISOString()
                },
                {
                  id: 'h-201',
                  radicado_id: decodeURIComponent(radId),
                  estado_anterior: 'BORRADOR_GENERADO',
                  estado_nuevo: 'EN_REVISION',
                  usuario_nombre: 'Sistema IA',
                  observacion: 'Asignación al responsable de atención ciudadana',
                  fecha: new Date(Date.now() - 3600000).toISOString()
                }
              ]
            }));
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
