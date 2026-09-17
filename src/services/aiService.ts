import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
//  AI SERVICE — GEMINI OCR + GROK NORMATIVAS
// ─────────────────────────────────────────────

interface GeminiOCRResult {
  success: boolean;
  text: string;
  error?: string;
}

interface GrokResponse {
  success: boolean;
  draft: string;
  normativasUsadas: string[];
  error?: string;
}

// Claves por defecto institucionales de respaldo
const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const DEFAULT_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const DEFAULT_GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

// Obtener configuración actual de la BD con soporte para caché local
async function getConfig(clave: string): Promise<string> {
  try {
    if (typeof window !== 'undefined') {
      const localVal = localStorage.getItem(`app_cfg_${clave}`);
      if (localVal && localVal.trim() !== '') return localVal;
    }
    const { data } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', clave)
      .single();
    return data?.valor || '';
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────
//  GEMINI — Exclusivo para OCR (PNG, JPG, WEBP, PDF)
// ─────────────────────────────────────────────
export async function ocrExtractText(file: File): Promise<GeminiOCRResult> {
  try {
    const apiKey = (await getConfig('gemini_api_key')) || DEFAULT_GEMINI_KEY;
    if (!apiKey) {
      return { success: false, text: '', error: 'API Key de Gemini no configurada en el panel administrativo.' };
    }

    // Convertir archivo a base64
    const base64 = await fileToBase64(file);
    
    // Detección precisa de MIME Type para imágenes y documentos
    let mimeType = file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'pdf') mimeType = 'application/pdf';
      else mimeType = 'image/jpeg';
    }

    const body = {
      contents: [
        {
          parts: [
            {
              text: 'Extrae todo el texto visible de esta imagen o documento de forma literal y completa. No hagas análisis, solo extrae el texto tal como aparece.'
            },
            {
              inlineData: {
                mimeType,
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 4096
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return { success: false, text: '', error: `Gemini API error: ${err}` };
    }

    const result = await response.json();
    const extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { success: true, text: extractedText };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, text: '', error: `Error OCR: ${msg}` };
  }
}

// Url de imagen pública a base64
export async function ocrFromUrl(imageUrl: string): Promise<GeminiOCRResult> {
  try {
    const apiKey = (await getConfig('gemini_api_key')) || DEFAULT_GEMINI_KEY;
    if (!apiKey) {
      return { success: false, text: '', error: 'API Key de Gemini no configurada.' };
    }

    const body = {
      contents: [
        {
          parts: [
            { text: 'Extrae todo el texto visible de esta imagen de forma literal y completa.' },
            { fileData: { mimeType: 'image/jpeg', fileUri: imageUrl } }
          ]
        }
      ],
      generationConfig: { temperature: 0.0, maxOutputTokens: 4096 }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!response.ok) {
      const err = await response.text();
      return { success: false, text: '', error: `Gemini error: ${err}` };
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { success: true, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, text: '', error: msg };
  }
}

// ─────────────────────────────────────────────
//  GROK — Consulta normativas + genera respuesta
// ─────────────────────────────────────────────
export async function generateOfficialResponse(
  peticionTexto: string,
  categoria: string
): Promise<GrokResponse> {
  try {
    const openrouterKey = (await getConfig('openrouter_api_key')) || DEFAULT_OPENROUTER_KEY;
    const grokApiKey    = (await getConfig('grok_api_key')) || DEFAULT_GROQ_KEY;

    const apiKey = openrouterKey || grokApiKey;
    if (!apiKey) {
      return {
        success: false,
        draft: '',
        normativasUsadas: [],
        error: 'API Key no configurada. Ve al Panel Admin → "APIs e IA" y agrega tu clave de OpenRouter o Groq.'
      };
    }

    const useOpenRouter = !!openrouterKey;
    const endpoint = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    const model = useOpenRouter ? 'inclusionai/ling-3.0-flash-vl:free' : 'qwen/qwen3.8-27b';

    const systemPrompt  = await getConfig('grok_system_prompt');
    const temperatureStr = await getConfig('grok_temperature');
    const maxTokensStr  = await getConfig('grok_max_tokens');

    // 1. Buscar normativas relevantes en Supabase
    let normativasTexto = '';
    const normativasUsadas: string[] = [];
    try {
      const { data: normativas } = await supabase
        .from('normativas_politicas')
        .select('titulo, articulo_referencia, contenido, categoria')
        .or(`categoria.eq.${categoria},titulo.ilike.%${categoria}%`)
        .limit(5);

      if (normativas && normativas.length > 0) {
        normativasTexto = normativas
          .map((n: Record<string, unknown>) => {
            const titulo = String(n.titulo || '');
            const ref = String(n.articulo_referencia || '');
            const contenido = String(n.contenido || '');
            normativasUsadas.push(`${titulo} — ${ref}`);
            return `NORMATIVA: ${titulo}\nREFERENCIA: ${ref}\nCONTENIDO: ${contenido}`;
          })
          .join('\n\n---\n\n');
      }
    } catch (e) {
      console.warn('Error consultando normativas:', e);
    }

    // 2. Construir prompt
    const userMessage = normativasTexto
      ? `PETICIÓN CIUDADANA:\n${peticionTexto}\n\nNORMATIVAS APLICABLES ENCONTRADAS EN SUPABASE:\n${normativasTexto}\n\nRedacta una respuesta oficial institucional en español citando las normativas aplicables.`
      : `PETICIÓN CIUDADANA:\n${peticionTexto}\n\nNo se encontraron normativas específicas. Redacta una respuesta oficial cordial en español indicando que la solicitud está siendo gestionada.`;

    // 3. Llamar API (OpenRouter o Groq, misma interfaz OpenAI-compatible)
    const body = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt || 'Eres un asistente oficial de la Alcaldía Municipal. Redacta respuestas institucionales formales, claras y respetuosas ÚNICAMENTE en español.'
        },
        { role: 'user', content: userMessage }
      ],
      temperature: parseFloat(temperatureStr || '0.3'),
      max_tokens: parseInt(maxTokensStr || '2048', 10)
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(useOpenRouter && { 'HTTP-Referer': window.location.origin })
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      const provider = useOpenRouter ? 'OpenRouter' : 'Groq';
      return { success: false, draft: '', normativasUsadas, error: `${provider} API error: ${err}` };
    }

    const result = await response.json();
    const draft = result?.choices?.[0]?.message?.content || '';

    return { success: true, draft, normativasUsadas };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, draft: '', normativasUsadas: [], error: msg };
  }
}

// ─────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:...;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
