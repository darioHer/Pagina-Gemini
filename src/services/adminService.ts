import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
//  TIPOS ADMIN
// ─────────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  cedula?: string;
  telefono?: string;
  avatar?: string;
  role_id: string;
  role_nombre?: string;
  verificado?: boolean;
  password_set?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AppConfig {
  id?: string;
  clave: string;
  valor: string;
  descripcion?: string;
  updated_at?: string;
}

export interface PeticionAdmin {
  id: string;
  solicitante: string;
  email_solicitante: string;
  cedula_solicitante?: string;
  categoria: string;
  tipo_solicitud: string;
  asunto: string;
  descripcion?: string;
  estado: string;
  fecha_radicacion: string;
  respuesta_oficial?: string;
  respuesta_borrador?: string;
  validado_por?: string;
  plazo_legal?: string;
}

export interface RolItem {
  id: string;
  nombre: string;
  descripcion?: string;
}

// ─────────────────────────────────────────────
//  USUARIOS
// ─────────────────────────────────────────────
export async function getAllUsers(): Promise<AdminUser[]> {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, roles(id, nombre)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getAllUsers error:', error.message);
      return [];
    }

    return (data || []).map((u: Record<string, unknown> & { roles?: { id: string; nombre: string } }) => ({
      id: String(u.id || ''),
      email: String(u.email || ''),
      nombre: String(u.nombre || ''),
      cedula: u.cedula ? String(u.cedula) : undefined,
      telefono: u.telefono ? String(u.telefono) : undefined,
      avatar: u.avatar ? String(u.avatar) : undefined,
      role_id: String(u.role_id || 'ciudadano'),
      role_nombre: u.roles?.nombre || 'Ciudadano General',
      verificado: u.verificado !== false, // default true if undefined
      password_set: Boolean(u.password_hash),
      created_at: u.created_at ? String(u.created_at) : undefined,
      updated_at: u.updated_at ? String(u.updated_at) : undefined,
    }));
  } catch (e) {
    console.warn('getAllUsers exception:', e);
    return [];
  }
}

export async function updateUserRole(userId: string, newRoleId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ role_id: newRoleId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.warn('updateUserRole error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('updateUserRole exception:', e);
    return false;
  }
}

export async function updateUserVerification(userId: string, verificado: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ verificado, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.warn('updateUserVerification error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('updateUserVerification exception:', e);
    return false;
  }
}

export async function updateUserPassword(userId: string, userEmail: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Update in custom usuarios table
    const { error: dbError } = await supabase
      .from('usuarios')
      .update({ 
        password_hash: newPassword, // stored hash/credential
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);

    // 2. Also attempt update via Supabase Auth Admin if available
    try {
      if (supabase.auth && (supabase.auth as any).admin) {
        await (supabase.auth as any).admin.updateUserById(userId, { password: newPassword });
      }
    } catch {
      // Ignore if anon key doesn't have direct auth.admin privilege
    }

    if (dbError) {
      return { success: false, message: `Error en base de datos Supabase: ${dbError.message}` };
    }
    return { success: true, message: `Contraseña actualizada exitosamente para ${userEmail}.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Excepción al actualizar contraseña: ${msg}` };
  }
}

export async function getAllRoles(): Promise<RolItem[]> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('nombre');

    if (error || !data || data.length === 0) {
      return [
        { id: 'ciudadano', nombre: 'Ciudadano General' },
        { id: 'funcionario_alcaldia', nombre: 'Funcionario de Atención Ciudadana' },
        { id: 'analista_pqrs', nombre: 'Analista Técnico de Servicios' },
        { id: 'secretario', nombre: 'Secretario Dependencia' },
        { id: 'admin_municipal', nombre: 'Administrador del Portal' },
        { id: 'admin', nombre: 'Administrador del Sistema' },
      ];
    }

    return data.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      nombre: String(r.nombre || ''),
      descripcion: r.descripcion ? String(r.descripcion) : undefined,
    }));
  } catch (e) {
    return [
      { id: 'ciudadano', nombre: 'Ciudadano General' },
      { id: 'funcionario_alcaldia', nombre: 'Funcionario de Atención Ciudadana' },
      { id: 'analista_pqrs', nombre: 'Analista Técnico de Servicios' },
      { id: 'secretario', nombre: 'Secretario Dependencia' },
      { id: 'admin_municipal', nombre: 'Administrador del Portal' },
      { id: 'admin', nombre: 'Administrador del Sistema' },
    ];
  }
}

// ─────────────────────────────────────────────
//  CONFIGURACIÓN DE LA APP (CON KEYS REALES)
// ─────────────────────────────────────────────
const defaultConfigs: AppConfig[] = [
  { 
    clave: 'gemini_api_key', 
    valor: import.meta.env.VITE_GEMINI_API_KEY || '', 
    descripcion: 'API Key de Google Gemini (Google AI Studio) — Exclusiva para OCR de imágenes y PDFs' 
  },
  { 
    clave: 'grok_api_key', 
    valor: import.meta.env.VITE_GROQ_API_KEY || '', 
    descripcion: 'API Key de Grok / Groq para consultar normativas en Supabase y responder peticiones' 
  },
  { 
    clave: 'openrouter_api_key', 
    valor: import.meta.env.VITE_OPENROUTER_API_KEY || '', 
    descripcion: 'API Key de OpenRouter (respaldo y modelos alternativos de Grok/LLaMA)' 
  },
  { 
    clave: 'grok_system_prompt', 
    valor: 'Eres el Asistente Jurídico e Institucional Oficial de la Alcaldía Municipal. Tu rol por gobernanza es consultar y verificar rigurosamente las normativas vigentes almacenadas en Supabase (decretos, acuerdos, leyes y resoluciones). En base exclusiva a estas normativas, redacta una respuesta oficial motivada, clara, cordial y formal para el ciudadano solicitante, citando los artículos y plazos legales correspondientes. El radicado debe quedar listo para la validación y firma del funcionario o rol encargado.', 
    descripcion: 'Rol del Sistema (System Prompt) institucional para Grok' 
  },
  { 
    clave: 'grok_temperature', 
    valor: '0.25', 
    descripcion: 'Temperatura de generación (0.0 = máxima precisión institucional, 1.0 = más creativo)' 
  },
  { 
    clave: 'grok_max_tokens', 
    valor: '2048', 
    descripcion: 'Límite máximo de tokens en la respuesta redactada' 
  },
];

export async function getAppConfig(): Promise<AppConfig[]> {
  try {
    const { data } = await supabase
      .from('configuracion_sistema')
      .select('*')
      .order('clave');

    let configs = (data && data.length > 0)
      ? data.map((c: Record<string, unknown>) => ({
          id: c.id ? String(c.id) : undefined,
          clave: String(c.clave || ''),
          valor: String(c.valor || ''),
          descripcion: c.descripcion ? String(c.descripcion) : undefined,
          updated_at: c.updated_at ? String(c.updated_at) : undefined,
        }))
      : [...defaultConfigs];

    // Combinar con valores de localStorage si existen
    if (typeof window !== 'undefined') {
      configs = configs.map(c => {
        const localVal = localStorage.getItem(`app_cfg_${c.clave}`);
        return (localVal !== null && localVal !== '') ? { ...c, valor: localVal } : c;
      });
    }

    return configs;
  } catch (e) {
    console.warn('getAppConfig exception:', e);
    return defaultConfigs;
  }
}

export async function saveAppConfig(configs: AppConfig[]): Promise<boolean> {
  try {
    for (const cfg of configs) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`app_cfg_${cfg.clave}`, cfg.valor);
      }
      try {
        const { error } = await supabase
          .from('configuracion_sistema')
          .upsert(
            { clave: cfg.clave, valor: cfg.valor, descripcion: cfg.descripcion, updated_at: new Date().toISOString() },
            { onConflict: 'clave' }
          );
        if (error) {
          console.warn('saveAppConfig upsert warning:', error.message);
        }
      } catch (dbErr) {
        console.warn('saveAppConfig DB warning:', dbErr);
      }
    }
    return true;
  } catch (e) {
    console.warn('saveAppConfig exception:', e);
    return false;
  }
}

// ─────────────────────────────────────────────
//  PETICIONES PARA VALIDACIÓN
// ─────────────────────────────────────────────
export async function getPendingValidations(): Promise<PeticionAdmin[]> {
  try {
    const { data, error } = await supabase
      .from('peticiones_pqrs')
      .select('*')
      .in('estado', ['En trámite', 'Pendiente revisión', 'En revisión'])
      .order('fecha_radicacion', { ascending: true });

    if (error || !data) {
      console.warn('getPendingValidations error:', error?.message);
      return [];
    }

    return data.map((p: Record<string, unknown>) => ({
      id: String(p.id || ''),
      solicitante: String(p.solicitante || ''),
      email_solicitante: String(p.email_solicitante || ''),
      cedula_solicitante: p.cedula_solicitante ? String(p.cedula_solicitante) : undefined,
      categoria: String(p.categoria || ''),
      tipo_solicitud: String(p.tipo_solicitud || ''),
      asunto: String(p.asunto || ''),
      descripcion: p.descripcion ? String(p.descripcion) : undefined,
      estado: String(p.estado || ''),
      fecha_radicacion: String(p.fecha_radicacion || ''),
      respuesta_oficial: p.respuesta_oficial ? String(p.respuesta_oficial) : undefined,
      respuesta_borrador: p.respuesta_borrador ? String(p.respuesta_borrador) : undefined,
      validado_por: p.validado_por ? String(p.validado_por) : undefined,
      plazo_legal: p.plazo_legal ? String(p.plazo_legal) : undefined,
    }));
  } catch (e) {
    console.warn('getPendingValidations exception:', e);
    return [];
  }
}

export async function approveResponse(
  peticionId: string,
  respuestaFinal: string,
  _validadorEmail?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('peticiones_pqrs')
      .update({
        estado: 'Resuelto',
        respuesta_oficial: respuestaFinal,
      })
      .eq('id', peticionId);

    if (error) {
      console.warn('approveResponse error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('approveResponse exception:', e);
    return false;
  }
}

export async function rejectPeticion(
  peticionId: string,
  motivoRechazo: string,
  _validadorEmail?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('peticiones_pqrs')
      .update({
        estado: 'Rechazado',
        respuesta_oficial: motivoRechazo,
      })
      .eq('id', peticionId);

    if (error) {
      console.warn('rejectPeticion error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('rejectPeticion exception:', e);
    return false;
  }
}
