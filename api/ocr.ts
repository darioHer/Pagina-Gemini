import express from 'express';
import { supabase } from '../src/lib/supabase';

const router = express.Router();

// Configuración de límites y tipos permitidos
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];

// Estructura por defecto para cuando los campos no estén presentes
const DEFAULT_EXTRACTION = {
  radicado: null,
  fecha: null,
  entidad: null,
  remitente: null,
  destinatario: null,
  asunto: null,
  peticion: null,
  normas_mencionadas: [],
  fechas_importantes: [],
  informacion_adicional: null,
  texto_extraido: null
};

export interface OcrPayload {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  base64Data: string; // Base64 data without header prefix
  userId?: string;
  userEmail?: string;
}

// Función auxiliar de validación de archivos
export function validateFile(fileName: string, mimeType: string, sizeBytes: number) {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Extensión de archivo inválida ('${ext}'). Extensiones permitidas: .png, .jpg, .jpeg, .webp, .pdf`
    };
  }

  const cleanMime = mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
    return {
      valid: false,
      error: `Tipo MIME no permitido ('${mimeType}'). Tipos soportados: PNG, JPEG, WEBP, PDF`
    };
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo permitido de 10 MB (Tamaño subido: ${sizeMb} MB)`
    };
  }

  return { valid: true };
}

// POST /api/ocr -> Procesa archivo para OCR y extracción con Gemini
router.post('/', async (req, res) => {
  let docId: string | null = null;

  try {
    const { fileName, mimeType, fileSizeBytes, base64Data, userId, userEmail } = req.body as OcrPayload;

    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: 'Parámetros incompletos. Se requiere fileName, mimeType y base64Data.' });
      return;
    }

    // 1. Validaciones
    const validation = validateFile(fileName, mimeType, fileSizeBytes || 0);
    if (!validation.valid) {
      // Registrar intento fallido por archivo inválido si es posible
      await supabase.from('documentos_ocr').insert({
        usuario_id: userId || null,
        usuario_email: userEmail || null,
        nombre_archivo: fileName,
        tipo_mime: mimeType,
        tamano_bytes: fileSizeBytes || 0,
        estado_ocr: 'OCR_ERROR',
        error_mensaje: validation.error
      });

      res.status(400).json({
        estado_ocr: 'OCR_ERROR',
        error: validation.error
      });
      return;
    }

    // 2. Registrar Documento en Estado RECIBIDO
    const { data: insertedDoc, error: insertError } = await supabase
      .from('documentos_ocr')
      .insert({
        usuario_id: userId || null,
        usuario_email: userEmail || null,
        nombre_archivo: fileName,
        tipo_mime: mimeType,
        tamano_bytes: fileSizeBytes,
        estado_ocr: 'RECIBIDO'
      })
      .select()
      .single();

    if (!insertError && insertedDoc) {
      docId = insertedDoc.id;
    }

    // 3. Transición de Estado a OCR_EN_PROCESO
    if (docId) {
      await supabase
        .from('documentos_ocr')
        .update({ estado_ocr: 'OCR_EN_PROCESO', updated_at: new Date().toISOString() })
        .eq('id', docId);
    }

    // 4. Invocación a Gemini API para OCR y extracción
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    // Limpiar string Base64 si incluye encabezado data:image/...;base64,
    const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');

    let extractedResult = { ...DEFAULT_EXTRACTION };
    let fullExtractedText = '';

    if (apiKey && !apiKey.includes('PLACEHOLDER')) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const promptText = `
Eres un OCR estricto y especializado para documentos públicos, cartas y peticiones PQRS de la Alcaldía Municipal.
Tu TAREA ÚNICA es realizar OCR completo al archivo adjunto y extraer la información estructurada en JSON.

REGLAS DE EXTRACCIÓN:
1. NO inventar ni alucinar datos bajo ninguna circunstancia.
2. Si un campo no está explícito en el documento, asigna null o arreglo vacío [].
3. Extrae exactamente en este esquema JSON sin formato adicional:

{
  "radicado": string | null (Número o código de radicado si existe),
  "fecha": string | null (Fecha del documento o radicación),
  "entidad": string | null (Entidad emisora o receptora),
  "remitente": string | null (Nombre de la persona o entidad que envía),
  "destinatario": string | null (Dirigido a quién o qué dependencia),
  "asunto": string | null (Resumen o título formal del asunto),
  "peticion": string | null (Transcripción exacta de lo solicitado o reclamado),
  "normas_mencionadas": string[] (Leyes, decretos, resoluciones citados en el texto),
  "fechas_importantes": string[] (Fechas relevantes mencionadas),
  "informacion_adicional": string | null (Cualquier observación o dato clave),
  "texto_extraido": string | null (Transcripción OCR integra del documento completo)
}
`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: cleanBase64
                  }
                },
                { text: promptText }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error API Gemini (${response.status}): ${errText}`);
      }

      const geminiRes = await response.json();
      const rawJsonString = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawJsonString) {
        try {
          const parsed = JSON.parse(rawJsonString);
          extractedResult = {
            ...DEFAULT_EXTRACTION,
            ...parsed,
            normas_mencionadas: Array.isArray(parsed.normas_mencionadas) ? parsed.normas_mencionadas : []
          };
          fullExtractedText = extractedResult.texto_extraido || rawJsonString;
        } catch {
          fullExtractedText = rawJsonString;
          extractedResult.texto_extraido = rawJsonString;
        }
      }
    } else {
      // Modo demostración/desarrollo si no hay API key configurada
      extractedResult = {
        radicado: `RAD-${Date.now().toString().slice(-6)}`,
        fecha: new Date().toISOString().split('T')[0],
        entidad: 'Alcaldía Municipal - Atención Ciudadana',
        remitente: 'Ciudadano Solicitante',
        destinatario: 'Secretaría de Infraestructura y Obras Públicas',
        asunto: `Solicitud de inspección técnica para el archivo ${fileName}`,
        peticion: 'Por medio del presente documento me dirijo a su despacho para solicitar amablemente la revisión técnica e intervención del sector...',
        normas_mencionadas: ['Decreto Municipal 042 de 2024 - Art. 14', 'Ley Estatutaria 1712 de Transparencia'],
        fechas_importantes: [new Date().toISOString().split('T')[0]],
        informacion_adicional: `Documento procesado correctamente vía simulador OCR (${mimeType}).`,
        texto_extraido: `[OCR DEMO EXTRACTION] Documento: ${fileName}\nFecha de Proceso: ${new Date().toLocaleString()}\nTipo MIME: ${mimeType}\n\nSolicitud Formal presentada ante la Alcaldía Municipal para revisión e inspección técnica.`
      };
      fullExtractedText = extractedResult.texto_extraido;
    }

    // 5. Transición de Estado a OCR_COMPLETADO y guardar resultado
    if (docId) {
      await supabase
        .from('documentos_ocr')
        .update({
          estado_ocr: 'OCR_COMPLETADO',
          resultado_json: extractedResult,
          texto_extraido: fullExtractedText,
          updated_at: new Date().toISOString()
        })
        .eq('id', docId);
    }

    res.status(200).json({
      id: docId,
      estado_ocr: 'OCR_COMPLETADO',
      nombre_archivo: fileName,
      tipo_mime: mimeType,
      resultado_json: extractedResult,
      texto_extraido: fullExtractedText
    });

  } catch (error: any) {
    console.error('Error durante OCR con Gemini:', error);
    const errorMessage = error?.message || 'Error no especificado durante el proceso de OCR.';

    if (docId) {
      await supabase
        .from('documentos_ocr')
        .update({
          estado_ocr: 'OCR_ERROR',
          error_mensaje: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', docId);
    }

    res.status(500).json({
      estado_ocr: 'OCR_ERROR',
      error: errorMessage
    });
  }
});

// GET /api/ocr/historial -> Devuelve el historial de documentos procesados por OCR
router.get('/historial', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('documentos_ocr')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (err: any) {
    console.error('Error al consultar historial OCR:', err);
    res.status(500).json({ error: 'Error al consultar historial de documentos OCR.' });
  }
});

export default router;
