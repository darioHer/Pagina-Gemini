import express from 'express';
import { supabase } from '../src/lib/supabase';

const router = express.Router();

export interface GroqDraftPayload {
  radicadoId?: string;
  peticionData: {
    radicado?: string | null;
    fecha?: string | null;
    entidad?: string | null;
    remitente?: string | null;
    destinatario?: string | null;
    asunto?: string | null;
    peticion?: string | null;
    normas_mencionadas?: string[];
  };
  userId?: string;
  userEmail?: string;
}

// POST /api/groq-draft -> Genera borrador de respuesta oficial usando RAG + Groq
router.post('/', async (req, res) => {
  let draftId: string | null = null;

  try {
    const { radicadoId, peticionData, userId, userEmail } = req.body as GroqDraftPayload;

    if (!peticionData || (!peticionData.peticion && !peticionData.asunto)) {
      res.status(400).json({ error: 'Parámetros incompletos. Se requiere información de la petición extraída.' });
      return;
    }

    // 1. ESTADO 1: CONSULTANDO_NORMATIVA
    const { data: insertedDraft, error: draftInsertErr } = await supabase
      .from('borradores_respuestas')
      .insert({
        radicado_id: radicadoId || peticionData.radicado || `RAD-${Date.now().toString().slice(-6)}`,
        usuario_id: userId || null,
        usuario_email: userEmail || null,
        modelo_utilizado: 'groq-llama-3.3-70b-versatile',
        normativa_utilizada: [],
        prompt_configuracion: {},
        respuesta_borrador: 'Consultando normativa en Supabase...',
        estado: 'CONSULTANDO_NORMATIVA'
      })
      .select()
      .single();

    if (!draftInsertErr && insertedDraft) {
      draftId = insertedDraft.id;
    }

    // 2. Recuperar Normativa Relevante desde Supabase (RAG Lookup)
    const peticionText = `${peticionData.asunto || ''} ${peticionData.peticion || ''}`.toLowerCase();

    const { data: dbNormativas } = await supabase
      .from('normativas_politicas')
      .select('*');

    let normativasRecuperadas = dbNormativas || [];

    // Filtrado de coincidencia semántica / palabras clave
    if (normativasRecuperadas.length > 0) {
      normativasRecuperadas = normativasRecuperadas.filter((item: any) => {
        const itemText = `${item.titulo || ''} ${item.contenido || ''} ${item.resumen_ejecutivo || ''} ${item.categoria || ''}`.toLowerCase();
        
        // Coincidencia por términos clave
        const words = peticionText.split(/\s+/).filter(w => w.length > 3);
        const matchesWords = words.some(word => itemText.includes(word));
        return matchesWords;
      });
    }

    // 3. Leer Configuración de IA desde Supabase
    const { data: configData } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', 'ia_config')
      .single();

    const aiConfig = configData?.valor || {
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 2048,
      systemPrompt: 'Eres un asistente oficial de la Alcaldía Municipal especializado en normativas locales y atención ciudadana.'
    };

    const groqApiKey = process.env.GROQ_API_KEY;
    const modelToUse = aiConfig.groqModel || 'llama-3.3-70b-versatile';
    const temperatureToUse = typeof aiConfig.temperature === 'number' ? aiConfig.temperature : 0.3;

    // Preparar contexto normativo para el Prompt
    const hasNormative = normativasRecuperadas.length > 0;
    const normativasContextText = hasNormative
      ? normativasRecuperadas.map((n: any, idx: number) => `
NORMA ${idx + 1}:
- Título: ${n.titulo}
- Tipo / Referencia: ${n.tipo_norma || 'Decreto'} ${n.numero || ''} (${n.articulo_referencia || ''})
- Entidad Emisora: ${n.entidad || n.entidad_emisora || 'Alcaldía Municipal'}
- Contenido Oficial: ${n.contenido}
- Resumen: ${n.resumen_ejecutivo}
`).join('\n---\n')
      : 'ADVERTENCIA: No se encontraron normas o resoluciones específicas registradas en la base de datos para este tema.';

    const radicadoRef = radicadoId || peticionData.radicado || `RAD-${Date.now().toString().slice(-6)}`;
    const fechaRef = peticionData.fecha || new Date().toISOString().split('T')[0];
    const remitenteRef = peticionData.remitente || 'Ciudadano Solicitante';
    const asuntoRef = peticionData.asunto || 'Petición Ciudadana';
    const peticionRef = peticionData.peticion || 'Solicitud presentada ante la alcaldía.';

    const systemPromptText = `
${aiConfig.systemPrompt || 'Eres el Asistente Jurídico Oficial de la Alcaldía Municipal.'}

REGLAS STRICTAS ANTI-ALUCINACIÓN (OBLIGATORIAS):
1. Genera un BORRADOR DE RESPUESTA OFICIAL para la petición ciudadana.
2. Utiliza ÚNICAMENTE la normativa recuperada desde la base de datos municipal que se te proporciona más abajo.
3. Queda ESTRICTAMENTE PROHIBIDO inventar leyes, decretos, resoluciones, acuerdos, números de artículos, fechas o conceptos jurídicos que no estén explícitamente en el contexto normativo proporcionado.
4. Si la normativa recuperada NO contiene suficiente información para responder a la petición, DEBES INDICARLO CLARAMENTE en la respuesta redactando: "En la base de datos de normativa municipal no se encontró información legal suficiente para responder a esta solicitud en este momento." y NO inventar nada.
5. Encabeza el documento con la referencia del radicado, fecha y partes interesadas.
6. La respuesta debe generarse SIEMPRE en estado de BORRADOR.
`;

    const userPromptText = `
DATOS DEL RADICADO Y PETICIÓN EXTRAÍDA (VÍA GEMINI OCR):
- Radicado No.: ${radicadoRef}
- Fecha: ${fechaRef}
- Remitente / Ciudadano: ${remitenteRef}
- Asunto: ${asuntoRef}
- Transcripción de Petición: ${peticionRef}

NORMATIVA RECUPERADA DESDE LA BASE DE DATOS SUPABASE (CONTEXTO RAG):
${normativasContextText}

Instrucciones: Genera el Borrador de Respuesta Oficial respetando estrictamente las reglas anti-alucinación.
`;

    let draftGeneratedText = '';

    if (groqApiKey && !groqApiKey.includes('PLACEHOLDER')) {
      // Invocación Real a la API de Groq
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemPromptText },
            { role: 'user', content: userPromptText }
          ],
          temperature: temperatureToUse,
          max_tokens: aiConfig.maxTokens || 2048
        })
      });

      if (!response.ok) {
        const errErr = await response.text();
        throw new Error(`Error API Groq (${response.status}): ${errErr}`);
      }

      const groqRes = await response.json();
      draftGeneratedText = groqRes.choices?.[0]?.message?.content || '';
    } else {
      // Modo Simulación Servidor / Fallback si no hay API key de Groq configurada
      if (hasNormative) {
        const normaUsada = normativasRecuperadas[0];
        draftGeneratedText = `ALCALDÍA MUNICIPAL DE ATENCIÓN CIUDADANA
RESPUESTA OFICIAL - ESTADO: BORRADOR

Radicado No.: ${radicadoRef}
Fecha: ${fechaRef}
Señor(a): ${remitenteRef}
Asunto: ${asuntoRef}

Respetado(a) ciudadano(a),

En atención a su petición con radicado No. ${radicadoRef} en la cual manifiesta: "${peticionRef.slice(0, 150)}...", nos permitimos informarle que, de conformidad con la normativa municipal vigente recuperada desde nuestro sistema:

De acuerdo con ${normaUsada.titulo} (${normaUsada.articulo_referencia || 'Decreto Municipal'}), ${normaUsada.resumen_ejecutivo || normaUsada.contenido}

En consecuencia, la administración municipal procederá a dar trámite a su solicitud dentro de los plazos legales establecidos.

Cordialmente,

DESPACHO DE ATENCIÓN CIUDADANA
Alcaldía Municipal
(DOCUMENTO EN ESTADO BORRADOR - REQUIERE VALIDACIÓN DE UN REVISOR)`;
      } else {
        draftGeneratedText = `ALCALDÍA MUNICIPAL DE ATENCIÓN CIUDADANA
RESPUESTA OFICIAL - ESTADO: BORRADOR

Radicado No.: ${radicadoRef}
Fecha: ${fechaRef}
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
    }

    const normativasResumen = normativasRecuperadas.map((n: any) => ({
      id: n.id,
      titulo: n.titulo,
      tipo_norma: n.tipo_norma || 'Decreto',
      numero: n.numero || n.articulo_referencia || 'N/A'
    }));

    // 4. ESTADO 2: BORRADOR_GENERADO (Guardar en Supabase)
    if (draftId) {
      await supabase
        .from('borradores_respuestas')
        .update({
          modelo_utilizado: modelToUse,
          normativa_utilizada: normativasResumen,
          prompt_configuracion: {
            systemPrompt: aiConfig.systemPrompt,
            temperature: temperatureToUse,
            maxTokens: aiConfig.maxTokens
          },
          respuesta_borrador: draftGeneratedText,
          estado: 'BORRADOR_GENERADO',
          updated_at: new Date().toISOString()
        })
        .eq('id', draftId);
    }

    res.status(200).json({
      id: draftId,
      estado: 'BORRADOR_GENERADO',
      radicado_id: radicadoRef,
      modelo_utilizado: modelToUse,
      normativa_utilizada: normativasResumen,
      respuesta_borrador: draftGeneratedText,
      normativas_encontradas_count: normativasRecuperadas.length
    });

  } catch (err: any) {
    console.error('Error al generar borrador con Groq RAG:', err);
    res.status(500).json({
      estado: 'BORRADOR_ERROR',
      error: err?.message || 'Error al generar borrador de respuesta oficial mediante Groq.'
    });
  }
});

// GET /api/groq-draft/historial -> Devuelve el historial de borradores generados
router.get('/historial', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('borradores_respuestas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (err: any) {
    console.error('Error al consultar historial de borradores Groq:', err);
    res.status(500).json({ error: 'Error al consultar historial de borradores.' });
  }
});

export default router;
