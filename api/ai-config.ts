import express from 'express';
import { supabase } from '../src/lib/supabase';

const router = express.Router();

// Helper to mask sensitive API keys (e.g. AIzaSy12345678 -> ••••••••••••5678)
export function maskApiKey(key: string | undefined): string {
  if (!key || key.trim() === '' || key.includes('PLACEHOLDER')) {
    return '•••••••••••• (Sin configurar)';
  }
  const cleanKey = key.trim();
  if (cleanKey.length <= 4) return '••••••••';
  const suffix = cleanKey.slice(-4);
  const prefix = cleanKey.slice(0, 3);
  return `${prefix}••••••••••••${suffix}`;
}

// GET /api/ai-config -> Devuelve la configuración con llaves estrictamente enmascaradas
router.get('/', async (_req, res) => {
  try {
    const { data } = await supabase
      .from('configuracion_sistema')
      .select('valor, updated_at, updated_by')
      .eq('clave', 'ia_config')
      .single();

    const envGeminiKey = process.env.GEMINI_API_KEY;
    const envGroqKey = process.env.GROQ_API_KEY;

    const baseConfig = data?.valor || {
      geminiModel: 'gemini-1.5-flash',
      geminiOcrMode: 'structured',
      groqModel: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 2048,
      topP: 0.9,
      systemPrompt: 'Eres un asistente oficial de la Alcaldía Municipal especializado en normativas locales y atención ciudadana.'
    };

    res.status(200).json({
      ...baseConfig,
      geminiApiKeyMasked: maskApiKey(envGeminiKey),
      groqApiKeyMasked: maskApiKey(envGroqKey),
      geminiApiKeyConfigured: Boolean(envGeminiKey && !envGeminiKey.includes('PLACEHOLDER')),
      groqApiKeyConfigured: Boolean(envGroqKey && !envGroqKey.includes('PLACEHOLDER')),
      updatedAt: data?.updated_at || new Date().toISOString(),
      updatedBy: data?.updated_by || 'Sistema'
    });
  } catch (error) {
    console.error('Error al leer configuración de IA server-side:', error);
    res.status(500).json({ error: 'Error interno del servidor al consultar la configuración de IA.' });
  }
});

export default router;
