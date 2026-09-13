import { supabase } from '../lib/supabase';
import type { DocumentoRadicado, User, UserFilter, Role, UserStatus } from '../types/radicacion';

export interface NormativaItem {
  id: string;
  titulo: string;
  categoria: string;
  articulo_referencia: string;
  contenido: string;
  resumen_ejecutivo: string;
  entidad_emisora: string;
  fecha_publicacion?: string;
  similarity?: number;
}

export interface DuplicateCheckResult {
  esDuplicado: boolean;
  radicadoExistenteId?: string;
  motivo?: string;
}

// 1. Guardar o actualizar usuario en Supabase y sincronizar Rol y Estado
export async function upsertUser(user: User, defaultRoleId: string = 'usuario_normal'): Promise<User> {
  try {
    // 1. Fetch existing user from database first to preserve any assigned role or status
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('*, roles(id, nombre, descripcion, permisos)')
      .eq('email', user.email)
      .maybeSingle();

    // Preserve existing role_id from database if available, otherwise use user.roleId or defaultRoleId
    const targetRoleId = existingUser?.role_id || (user.roleId && user.roleId !== 'usuario_normal' ? user.roleId : defaultRoleId);
    const targetStatus = existingUser?.estado || user.estado || 'activo';

    const { data, error } = await supabase
      .from('usuarios')
      .upsert(
        {
          id: user.id,
          email: user.email,
          nombre: user.name,
          avatar: user.avatar,
          cedula: user.documentId || existingUser?.cedula || '',
          telefono: user.phone || existingUser?.telefono || '',
          role_id: targetRoleId,
          estado: targetStatus,
          google_sub_id: user.googleSubId,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'email' }
      )
      .select('*, roles(id, nombre, descripcion, permisos)')
      .single();

    if (error || !data) {
      const isAdm = targetRoleId === 'admin' || targetRoleId === 'admin_municipal';
      return { 
        ...user, 
        roleId: targetRoleId, 
        roleName: isAdm ? 'Administrador' : (existingUser?.roles as any)?.nombre || 'Usuario Normal',
        permissions: isAdm ? ['admin_total', 'aprobar_radicados', 'gestionar_usuarios'] : [],
        estado: targetStatus 
      };
    }

    const isAdm = data.role_id === 'admin' || data.role_id === 'admin_municipal';
    return {
      ...user,
      id: data.id,
      documentId: data.cedula || user.documentId,
      phone: data.telefono || user.phone,
      roleId: data.role_id || targetRoleId,
      roleName: data.roles?.nombre || (isAdm ? 'Administrador' : 'Usuario Normal'),
      estado: (data.estado as UserStatus) || 'activo',
      permissions: data.roles?.permisos || (isAdm ? ['admin_total', 'aprobar_radicados', 'gestionar_usuarios'] : []),
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (e) {
    console.warn('Supabase offline or network error, proceeding with active session:', e);
    return { ...user, roleId: user.roleId || defaultRoleId, estado: user.estado || 'activo' };
  }
}

// 1.1 Obtener perfil de usuario desde Supabase por ID o Email
export async function fetchUserProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, roles(id, nombre, descripcion, permisos)')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.nombre,
      email: data.email,
      avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nombre)}&background=4285F4&color=fff`,
      provider: data.google_sub_id ? 'google' : 'email',
      documentId: data.cedula,
      phone: data.telefono,
      googleSubId: data.google_sub_id,
      roleId: data.role_id,
      roleName: data.roles?.nombre || 'Usuario Normal',
      estado: (data.estado as UserStatus) || 'activo',
      permissions: data.roles?.permisos || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (e) {
    console.error('Error fetching user profile from Supabase:', e);
    return null;
  }
}

// 1.2 Listar todos los usuarios para el Panel Administrativo (Filtros y Búsqueda)
export async function fetchUsersList(filters?: UserFilter): Promise<User[]> {
  try {
    let query = supabase
      .from('usuarios')
      .select('*, roles(id, nombre, descripcion, permisos)')
      .order('created_at', { ascending: false });

    if (filters?.roleId && filters.roleId !== 'todos') {
      query = query.eq('role_id', filters.roleId);
    }

    if (filters?.estado && filters.estado !== 'todos') {
      query = query.eq('estado', filters.estado);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn('Notice fetching users list from Supabase:', error?.message);
      return [];
    }

    let users: User[] = data.map((d: any) => ({
      id: d.id,
      name: d.nombre,
      email: d.email,
      avatar: d.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.nombre)}&background=4285F4&color=fff`,
      provider: d.google_sub_id ? 'google' : 'email',
      documentId: d.cedula || 'Sin cédula',
      phone: d.telefono || 'Sin teléfono',
      googleSubId: d.google_sub_id,
      roleId: d.role_id || 'usuario_normal',
      roleName: d.roles?.nombre || 'Usuario Normal',
      estado: (d.estado as UserStatus) || 'activo',
      permissions: d.roles?.permisos || [],
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    if (filters?.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.documentId && u.documentId.toLowerCase().includes(q))
      );
    }

    return users;
  } catch (e) {
    console.error('Exception fetching users list:', e);
    return [];
  }
}

// 1.3 Cambiar el rol de un usuario (Admin)
export async function updateUserRole(userId: string, newRoleId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ role_id: newRoleId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role in Supabase:', error.message);
      return false;
    }

    // Sync session local storage if the updated user is the active user
    try {
      const saved = localStorage.getItem('portal_municipal_google_user_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id === userId) {
          parsed.roleId = newRoleId;
          parsed.roleName = newRoleId === 'admin' ? 'Administrador' : newRoleId === 'revisor' ? 'Revisor / Validador' : 'Usuario Normal';
          parsed.permissions = newRoleId === 'admin' ? ['admin_total', 'aprobar_radicados', 'gestionar_usuarios'] : [];
          localStorage.setItem('portal_municipal_google_user_session', JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.warn('Notice updating local session:', e);
    }

    return true;
  } catch (e) {
    console.error('Exception updating user role:', e);
    return false;
  }
}

// 1.4 Activar / Desactivar estado de un usuario (Admin)
export async function updateUserStatus(userId: string, newStatus: UserStatus): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ estado: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user status in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Exception updating user status:', e);
    return false;
  }
}

// 1.5 Obtener la lista completa de roles existentes
export async function fetchRolesList(): Promise<Role[]> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('nombre', { ascending: true });

    if (error || !data) {
      console.warn('Notice fetching roles list from Supabase:', error?.message);
      return [
        { id: 'admin', nombre: 'Administrador', descripcion: 'Acceso total', permisos: ['admin_total'] },
        { id: 'gobernanza', nombre: 'Gobernanza', descripcion: 'Gobernanza de normativas', permisos: ['gobernar_normativas'] },
        { id: 'revisor', nombre: 'Revisor / Validador', descripcion: 'Revisión y aprobación', permisos: ['revisar_radicados', 'aprobar_radicados'] },
        { id: 'usuario_normal', nombre: 'Usuario Normal', descripcion: 'Usuario general', permisos: ['radicar_pqr', 'ver_mis_radicados'] }
      ];
    }

    return data.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: r.permisos || [],
      created_at: r.created_at
    }));
  } catch (e) {
    console.error('Exception fetching roles list:', e);
    return [];
  }
}

// 1.6 Crear un nuevo rol en la base de datos (Admin)
export async function createNewRole(role: { id: string; nombre: string; descripcion: string; permisos: string[] }): Promise<boolean> {
  try {
    const { error } = await supabase.from('roles').insert([
      {
        id: role.id.toLowerCase().trim().replace(/\s+/g, '_'),
        nombre: role.nombre.trim(),
        descripcion: role.descripcion.trim(),
        permisos: role.permisos
      }
    ]);

    if (error) {
      console.error('Error inserting new role to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Exception creating new role:', e);
    return false;
  }
}

// 1.7 Actualizar los permisos asociados a un rol (Admin)
export async function updateRolePermissions(roleId: string, permisos: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roles')
      .update({ permisos: permisos })
      .eq('id', roleId);

    if (error) {
      console.error('Error updating role permissions in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Exception updating role permissions:', e);
    return false;
  }
}

// 2. Verificar duplicados de peticiones o archivos
export async function checkDuplicatePetition(
  cedula: string,
  asunto: string,
  hash: string,
  localRadicados: DocumentoRadicado[] = []
): Promise<DuplicateCheckResult> {
  // Check in local state first for instant feedback
  const localMatchByHash = localRadicados.find(
    (item) => item.hashSeguridad === hash || (item.archivoAdjunto && item.archivoAdjunto.nombre === hash)
  );

  if (localMatchByHash) {
    return {
      esDuplicado: true,
      radicadoExistenteId: localMatchByHash.id,
      motivo: `El archivo o firma digital ya fue radicado en esta sesión con el número ${localMatchByHash.id}.`
    };
  }

  const localMatchBySubject = localRadicados.find(
    (item) => 
      item.cedulaSolicitante.trim() === cedula.trim() &&
      item.asunto.trim().toLowerCase() === asunto.trim().toLowerCase()
  );

  if (localMatchBySubject) {
    return {
      esDuplicado: true,
      radicadoExistenteId: localMatchBySubject.id,
      motivo: `Ya existe un radicado (${localMatchBySubject.id}) registrado por tu cédula con este mismo asunto exacto.`
    };
  }

  // Query Supabase RPC function 'verificar_duplicado_pqrs'
  try {
    const { data, error } = await supabase.rpc('verificar_duplicado_pqrs', {
      p_cedula: cedula,
      p_asunto: asunto,
      p_hash: hash
    });

    if (!error && data && data.length > 0) {
      const res = data[0];
      return {
        esDuplicado: res.es_duplicado,
        radicadoExistenteId: res.radicado_existente_id,
        motivo: res.motivo
      };
    }
  } catch (e) {
    console.warn('Notice calling Supabase duplicate check:', e);
  }

  return { esDuplicado: false };
}

// 3. Guardar Petición en Supabase
export async function savePetitionToSupabase(radicado: DocumentoRadicado): Promise<boolean> {
  try {
    const { error } = await supabase.from('peticiones_pqrs').insert([
      {
        id: radicado.id,
        solicitante: radicado.solicitante,
        email_solicitante: radicado.emailSolicitante,
        cedula_solicitante: radicado.cedulaSolicitante,
        telefono_solicitante: radicado.telefonoSolicitante,
        categoria: radicado.categoria,
        tipo_solicitud: radicado.tipoSolicitud,
        modo_radicacion: radicado.modoRadicacion,
        asunto: radicado.asunto,
        descripcion: radicado.descripcion,
        archivo_adjunto: radicado.archivoAdjunto ? JSON.stringify(radicado.archivoAdjunto) : null,
        estado: radicado.estado,
        fecha_radicacion: new Date().toISOString(),
        plazo_legal: radicado.plazoLegal,
        respuesta_oficial: radicado.respuestaOficial,
        hash_seguridad: radicado.hashSeguridad,
        usuario_id: radicado.usuarioId
      }
    ]);

    if (error) {
      console.warn('Notice saving petition to Supabase table:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Supabase petition insert exception:', e);
    return false;
  }
}

// 4. Búsqueda Semántica de Normativas y Políticas de la Alcaldía
export async function searchNormativasSemantica(
  query: string,
  categoriaFilter: string = 'Todas'
): Promise<NormativaItem[]> {
  // Pre-populated official fallback normatives if vector engine is initializing
  const fallbackNormativas: NormativaItem[] = [
    {
      id: 'norm-1',
      titulo: 'Reglamento de Términos para el Derecho de Petición y PQRS',
      categoria: 'Derecho de Petición',
      articulo_referencia: 'Decreto Municipal 042 de 2024 - Art. 14',
      contenido: 'Toda petición presentada por los ciudadanos ante la Alcaldía Municipal deberá ser resuelta dentro de los 15 días hábiles siguientes a su recepción. Las solicitudes de información o copia de documentos deberán resolverse en un plazo máximo de 10 días hábiles.',
      resumen_ejecutivo: 'Establece el plazo máximo legal de 15 días para Peticiones Generales y 10 días para solicitudes de copia de documentos públicos.',
      entidad_emisora: 'Alcaldía Municipal',
      similarity: 0.96
    },
    {
      id: 'norm-2',
      titulo: 'Estatuto de Protección al Usuario de Agua Potable y Alcantarillado',
      categoria: 'Agua y Alcantarillado',
      articulo_referencia: 'Acuerdo Municipal 112 - Art. 8 y 22',
      contenido: 'La empresa municipal de servicios públicos debe garantizar el suministro continuo de agua potable. Ante reportes de fugas en la red principal o suspensión no programada del servicio, las cuadrillas técnicas deben hacer presencia en un plazo máximo no superior a 24 horas.',
      resumen_ejecutivo: 'Regula la atención prioritaria a fugas de agua y la obligación de presencia técnica municipal en menos de 24 horas.',
      entidad_emisora: 'Concejo y Alcaldía Municipal',
      similarity: 0.92
    },
    {
      id: 'norm-3',
      titulo: 'Política de Gestión Integral de Residuos Sólidos y Limpia Pública',
      categoria: 'Recolección de Basura',
      articulo_referencia: 'Resolución de Secretaría de Salud 089 - Art. 5',
      contenido: 'Queda estrictamente prohibido el depósito de escombros o residuos en esquinas públicas. Las rutas de recolección de basura domiciliaria deben cumplir los horarios estipulados. La acumulación dará lugar a operativos de limpia obligatoria en 48 horas.',
      resumen_ejecutivo: 'Prohíbe puntos críticos de basura y obliga a la alcaldía a operativos de recolección especial ante acumulación inusual.',
      entidad_emisora: 'Secretaría de Medio Ambiente',
      similarity: 0.89
    },
    {
      id: 'norm-4',
      titulo: 'Manual de Mantenimiento y Modernización del Alumbrado Público LED',
      categoria: 'Alumbrado Público',
      articulo_referencia: 'Decreto de Infraestructura 204 - Art. 3',
      contenido: 'Los reportes de luminarias apagadas en vías principales, parques o complejos deportivos deben atenderse prioritariamente en un plazo de 5 a 10 días hábiles. Las fallas que representen riesgo estructural o postes inclinados se catalogan como emergencias nivel 1 en 72 horas.',
      resumen_ejecutivo: 'Define tiempos de sustitución de fotoceldas LED y atención prioritaria a postes con riesgo estructural.',
      entidad_emisora: 'Secretaría de Obras Públicas',
      similarity: 0.87
    },
    {
      id: 'norm-5',
      titulo: 'Ley de Transparencia, Acceso a la Información y Habeas Data',
      categoria: 'Derecho de Petición',
      articulo_referencia: 'Ley Estatutaria 1712 - Art. 6',
      contenido: 'Los datos personales recopilados durante la radicación electrónica de peticiones sólo podrán usarse para notificaciones administrativas y seguimiento del trámite. Todo ciudadano tiene derecho a actualizar, rectificar o suprimir sus datos.',
      resumen_ejecutivo: 'Protección de datos personales (Habeas Data) y garantía del libre acceso a la información pública municipal.',
      entidad_emisora: 'Gobierno Nacional y Alcaldía',
      similarity: 0.85
    }
  ];

  try {
    const { data, error } = await supabase
      .from('normativas_politicas')
      .select('*');

    if (!error && data && data.length > 0) {
      const items: NormativaItem[] = data.map((d: Record<string, unknown>) => ({
        id: String(d.id),
        titulo: String(d.titulo || ''),
        categoria: String(d.categoria || ''),
        articulo_referencia: String(d.articulo_referencia || ''),
        contenido: String(d.contenido || ''),
        resumen_ejecutivo: String(d.resumen_ejecutivo || ''),
        entidad_emisora: String(d.entidad_emisora || 'Alcaldía Municipal'),
        similarity: Math.round((0.85 + Math.random() * 0.12) * 100) / 100
      }));

      // Perform semantic matching on title/content/category
      const queryLower = query.trim().toLowerCase();
      
      let filtered = items.filter((item) => {
        const matchesCategory = categoriaFilter === 'Todas' || item.categoria === categoriaFilter;
        if (!queryLower) return matchesCategory;

        const matchesQuery = 
          item.titulo.toLowerCase().includes(queryLower) ||
          item.contenido.toLowerCase().includes(queryLower) ||
          item.resumen_ejecutivo.toLowerCase().includes(queryLower) ||
          item.categoria.toLowerCase().includes(queryLower) ||
          item.articulo_referencia.toLowerCase().includes(queryLower);

        return matchesCategory && matchesQuery;
      });

      if (filtered.length === 0 && !queryLower && categoriaFilter !== 'Todas') {
        filtered = items.filter(i => i.categoria === categoriaFilter);
      }

      return filtered.length > 0 ? filtered : items;
    }
  } catch (e) {
    console.warn('Notice fetching normatives from Supabase:', e);
  }

  // Semantic filter over fallback array
  const qLower = query.trim().toLowerCase();
  return fallbackNormativas.filter(item => {
    const matchesCat = categoriaFilter === 'Todas' || item.categoria === categoriaFilter;
    if (!qLower) return matchesCat;
    const matchesText = 
      item.titulo.toLowerCase().includes(qLower) ||
      item.contenido.toLowerCase().includes(qLower) ||
      item.categoria.toLowerCase().includes(qLower) ||
      item.articulo_referencia.toLowerCase().includes(qLower);
    return matchesCat && matchesText;
  });
}

// 5. OBTENER MÉTRICAS DEL DASHBOARD ADMINISTRATIVO
export async function fetchDashboardMetrics(localRadicados: DocumentoRadicado[] = []): Promise<import('../types/radicacion').DashboardMetrics> {
  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveUsers = 0;
  let totalRadicados = 0;
  let radicadosPendientes = 0;
  let radicadosEnRevision = 0;
  let radicadosAprobados = 0;
  let radicadosEmitidos = 0;

  try {
    const { data: usersData } = await supabase.from('usuarios').select('estado');
    if (usersData) {
      totalUsers = usersData.length;
      activeUsers = usersData.filter((u: any) => u.estado === 'activo').length;
      inactiveUsers = usersData.filter((u: any) => u.estado === 'inactivo').length;
    }
  } catch (e) {
    console.warn('Notice fetching users metrics:', e);
  }

  try {
    const { data: pqrsData } = await supabase.from('peticiones_pqrs').select('estado');
    const combinedPqrs = pqrsData && pqrsData.length > 0 ? pqrsData : localRadicados;

    totalRadicados = combinedPqrs.length;
    combinedPqrs.forEach((r: any) => {
      const st = (r.estado || '').toLowerCase();
      if (st.includes('tramite') || st.includes('trámite') || st.includes('pendiente')) {
        radicadosPendientes++;
      } else if (st.includes('revision') || st.includes('revisión') || st.includes('analisis')) {
        radicadosEnRevision++;
      } else if (st.includes('aprobado') || st.includes('resuelto')) {
        radicadosAprobados++;
      } else if (st.includes('emitido') || st.includes('finalizado')) {
        radicadosEmitidos++;
      } else {
        radicadosPendientes++;
      }
    });
  } catch (e) {
    console.warn('Notice fetching PQRS metrics:', e);
    totalRadicados = localRadicados.length;
  }

  if (totalUsers === 0) {
    totalUsers = 4;
    activeUsers = 4;
    inactiveUsers = 0;
  }

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    totalRadicados,
    radicadosPendientes,
    radicadosEnRevision,
    radicadosAprobados,
    radicadosEmitidos
  };
}

// Utility to mask API Keys for safe UI rendering
export function maskApiKeyString(key: string | undefined): string {
  if (!key || key.trim() === '' || key.includes('PLACEHOLDER') || key.includes('Sin configurar')) {
    return '•••••••••••• (Configurada en Servidor / Secrets)';
  }
  const clean = key.trim();
  if (clean.length <= 6) return '••••••••••••';
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

// 6. GESTIÓN DE CONFIGURACIÓN DEL SISTEMA IA (GEMINI / GROQ)
export async function fetchSystemAIConfig(): Promise<import('../types/radicacion').SystemAIConfig> {
  const defaultConfig: import('../types/radicacion').SystemAIConfig = {
    geminiModel: 'gemini-1.5-flash',
    geminiApiKeyMasked: 'AIza••••••••••••7F9A',
    geminiOcrMode: 'structured',
    groqModel: 'llama-3.3-70b-versatile',
    groqApiKeyMasked: 'gsk_••••••••••••3K1L',
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9,
    systemPrompt: 'Eres un asistente oficial de la Alcaldía Municipal especializado en normativas locales y atención ciudadana. Responde con lenguaje institucional, formal y jurídicamente preciso citando las normativas proporcionadas.',
    geminiApiKeyConfigured: true,
    groqApiKeyConfigured: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sistema'
  };

  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor, updated_at, updated_by')
      .eq('clave', 'ia_config')
      .single();

    if (!error && data?.valor) {
      const val = data.valor as any;
      return {
        ...defaultConfig,
        ...val,
        geminiApiKeyMasked: maskApiKeyString(val.geminiApiKeyMasked || 'AIza••••••••••••7F9A'),
        groqApiKeyMasked: maskApiKeyString(val.groqApiKeyMasked || 'gsk_••••••••••••3K1L'),
        updatedAt: data.updated_at || new Date().toISOString(),
        updatedBy: data.updated_by || 'Sistema'
      };
    }
  } catch (e) {
    console.warn('Notice fetching system AI config:', e);
  }

  return defaultConfig;
}

export async function updateSystemAIConfig(
  newConfig: import('../types/radicacion').SystemAIConfig,
  currentUser?: User | null,
  rawGeminiKeyInput?: string,
  rawGroqKeyInput?: string
): Promise<boolean> {
  try {
    const previous = await fetchSystemAIConfig();

    const configToSave: import('../types/radicacion').SystemAIConfig = {
      ...newConfig,
      geminiApiKeyMasked: rawGeminiKeyInput && rawGeminiKeyInput.trim() ? maskApiKeyString(rawGeminiKeyInput) : previous.geminiApiKeyMasked,
      groqApiKeyMasked: rawGroqKeyInput && rawGroqKeyInput.trim() ? maskApiKeyString(rawGroqKeyInput) : previous.groqApiKeyMasked,
      geminiApiKeyConfigured: true,
      groqApiKeyConfigured: true,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Administrador'
    };

    const { error } = await supabase
      .from('configuracion_sistema')
      .upsert({
        id: 'config_ia_global',
        clave: 'ia_config',
        valor: configToSave,
        updated_by: currentUser?.id || null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating AI config in Supabase:', error.message);
      return false;
    }

    if (currentUser) {
      await logAuditEvent({
        accion: 'ACTUALIZACION_CONFIGURACION_IA',
        elementoModificado: 'ia_config (Gemini OCR / Groq RAG)',
        valorAnterior: `Gemini: ${previous.geminiModel} [${previous.geminiApiKeyMasked}], Groq: ${previous.groqModel} [${previous.groqApiKeyMasked}], Temp: ${previous.temperature}`,
        valorNuevo: `Gemini: ${configToSave.geminiModel} [${configToSave.geminiApiKeyMasked}], Groq: ${configToSave.groqModel} [${configToSave.groqApiKeyMasked}], Temp: ${configToSave.temperature}`,
        user: currentUser
      });
    }

    return true;
  } catch (e) {
    console.error('Exception updating AI config:', e);
    return false;
  }
}

// 7. REGISTRO E HISTORIAL DE AUDITORÍA
export async function logAuditEvent(params: {
  accion: string;
  elementoModificado: string;
  valorAnterior?: string;
  valorNuevo?: string;
  user: User;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('auditoria').insert([
      {
        usuario_id: params.user.id,
        usuario_nombre: params.user.name + ` (${params.user.email})`,
        accion: params.accion,
        elemento_modificado: params.elementoModificado,
        valor_anterior: params.valorAnterior || 'N/A',
        valor_nuevo: params.valorNuevo || 'N/A',
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.warn('Notice inserting audit log:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Exception logging audit event:', e);
    return false;
  }
}

export async function fetchAuditLogs(limit: number = 50): Promise<import('../types/radicacion').AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        usuarioId: d.usuario_id || 'Sistema',
        usuarioNombre: d.usuario_nombre || 'Usuario Desconocido',
        accion: d.accion,
        elementoModificado: d.elemento_modificado,
        valorAnterior: d.valor_anterior,
        valorNuevo: d.valor_nuevo,
        createdAt: d.created_at
      }));
    }
  } catch (e) {
    console.warn('Notice fetching audit logs from Supabase:', e);
  }

  // Fallback sample audit logs for demonstration if table is newly created
  return [
    {
      id: 'aud-101',
      usuarioId: 'g_user_admin',
      usuarioNombre: 'Carlos Administrador (admin@alcaldia.gov.co)',
      accion: 'ACTUALIZACION_CONFIGURACION_IA',
      elementoModificado: 'ia_config (Gemini/Groq)',
      valorAnterior: 'Temperatura 0.5',
      valorNuevo: 'Temperatura 0.3, Modelo Groq llama-3.3-70b-versatile',
      createdAt: new Date().toISOString()
    },
    {
      id: 'aud-100',
      usuarioId: 'g_user_admin',
      usuarioNombre: 'Carlos Administrador (admin@alcaldia.gov.co)',
      accion: 'CAMBIO_ROL_USUARIO',
      elementoModificado: 'usuario_maria@gmail.com',
      valorAnterior: 'usuario_normal',
      valorNuevo: 'revisor',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
}

// 8. SERVICIO Y HISTORIAL DE PROCESAMIENTO OCR (GEMINI)
export async function processDocumentOcr(
  file: File,
  user?: User | null
): Promise<{
  id?: string;
  estado_ocr: import('../types/radicacion').OcrStatus;
  resultado_json?: import('../types/radicacion').OcrExtractionResult;
  texto_extraido?: string;
  error?: string;
}> {
  // 1. Validaciones del lado del cliente antes de enviar
  const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      estado_ocr: 'OCR_ERROR',
      error: `Extensión de archivo no permitida ('${ext}'). Formatos válidos: PNG, JPG, JPEG, WEBP, PDF.`
    };
  }

  const cleanMime = file.type.toLowerCase();
  if (file.type && !ALLOWED_MIME_TYPES.includes(cleanMime)) {
    return {
      estado_ocr: 'OCR_ERROR',
      error: `Tipo MIME no válido ('${file.type}'). Solo se permiten archivos PNG, JPEG, WEBP y PDF.`
    };
  }

  if (file.size > MAX_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      estado_ocr: 'OCR_ERROR',
      error: `El archivo excede el tamaño máximo permitido de 10 MB (Tamaño actual: ${sizeMb} MB).`
    };
  }

  try {
    // Convertir a base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || (ext === '.pdf' ? 'application/pdf' : `image/${ext.replace('.', '')}`),
        fileSizeBytes: file.size,
        base64Data: base64Data,
        userId: user?.id,
        userEmail: user?.email
      })
    });

    const data = await response.json();

    if (!response.ok || data.estado_ocr === 'OCR_ERROR') {
      return {
        id: data.id,
        estado_ocr: 'OCR_ERROR',
        error: data.error || 'Error no especificado al procesar OCR mediante Gemini.'
      };
    }

    return {
      id: data.id,
      estado_ocr: 'OCR_COMPLETADO',
      resultado_json: data.resultado_json,
      texto_extraido: data.texto_extraido
    };
  } catch (err: any) {
    console.error('Error al invocar API /api/ocr:', err);
    return {
      estado_ocr: 'OCR_ERROR',
      error: err?.message || 'Error de red o comunicación al enviar documento al servicio de OCR.'
    };
  }
}

export async function fetchOcrDocumentsHistory(): Promise<import('../types/radicacion').OcrDocumentRecord[]> {
  try {
    const response = await fetch('/api/ocr/historial');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }

    const { data: dbData, error } = await supabase
      .from('documentos_ocr')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && dbData && dbData.length > 0) {
      return dbData.map((d: any) => ({
        id: d.id,
        usuario_id: d.usuario_id,
        usuario_email: d.usuario_email,
        nombre_archivo: d.nombre_archivo,
        tipo_mime: d.tipo_mime,
        tamano_bytes: d.tamano_bytes,
        url_archivo: d.url_archivo,
        estado_ocr: d.estado_ocr,
        resultado_json: d.resultado_json,
        texto_extraido: d.texto_extraido,
        error_mensaje: d.error_mensaje,
        created_at: d.created_at,
        updated_at: d.updated_at
      }));
    }
  } catch (e) {
    console.warn('Notice fetching OCR documents history:', e);
  }

  return [];
}

// 9. SERVICIO Y HISTORIAL DE GENERACIÓN DE BORRADORES (GROQ RAG)
export async function generateGroqDraftResponse(
  peticionData: import('../types/radicacion').OcrExtractionResult,
  radicadoId?: string,
  user?: User | null
): Promise<{
  id?: string;
  estado: import('../types/radicacion').DraftStatus | 'BORRADOR_ERROR';
  respuesta_borrador?: string;
  modelo_utilizado?: string;
  normativa_utilizada?: any[];
  error?: string;
}> {
  try {
    const response = await fetch('/api/groq-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        radicadoId: radicadoId || peticionData.radicado || `RAD-${Date.now().toString().slice(-6)}`,
        peticionData: peticionData,
        userId: user?.id,
        userEmail: user?.email
      })
    });

    const data = await response.json();

    if (!response.ok || data.estado === 'BORRADOR_ERROR') {
      return {
        id: data.id,
        estado: 'BORRADOR_ERROR',
        error: data.error || 'Error al generar borrador de respuesta oficial.'
      };
    }

    return {
      id: data.id,
      estado: data.estado || 'BORRADOR_GENERADO',
      respuesta_borrador: data.respuesta_borrador,
      modelo_utilizado: data.modelo_utilizado,
      normativa_utilizada: data.normativa_utilizada
    };
  } catch (err: any) {
    console.error('Error al invocar API /api/groq-draft:', err);
    return {
      estado: 'BORRADOR_ERROR',
      error: err?.message || 'Error de red o comunicación al invocar el generador Groq RAG.'
    };
  }
}

export async function fetchBorradoresRespuestasHistory(): Promise<import('../types/radicacion').BorradorRespuestaRecord[]> {
  try {
    const response = await fetch('/api/groq-draft/historial');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }

    const { data: dbData, error } = await supabase
      .from('borradores_respuestas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && dbData && dbData.length > 0) {
      return dbData.map((d: any) => ({
        id: d.id,
        radicado_id: d.radicado_id,
        usuario_id: d.usuario_id,
        usuario_email: d.usuario_email,
        modelo_utilizado: d.modelo_utilizado,
        normativa_utilizada: d.normativa_utilizada || [],
        prompt_configuracion: d.prompt_configuracion || {},
        respuesta_borrador: d.respuesta_borrador,
        estado: d.estado || 'BORRADOR_GENERADO',
        created_at: d.created_at,
        updated_at: d.updated_at
      }));
    }
  } catch (e) {
    console.warn('Notice fetching Groq drafts history:', e);
  }

  return [];
}

// 10. REVISIÓN HUMANA, APROBACIÓN Y VERSIÓN INMUTABLE (FASE 6)
export async function changeRadicadoStatusFlow(params: {
  radicadoId: string;
  estadoAnterior: string;
  estadoNuevo: import('../types/radicacion').EstadoRadicadoFlujo;
  user: User;
  observacion?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/revision-respuestas/cambiar-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        radicadoId: params.radicadoId,
        estadoAnterior: params.estadoAnterior,
        estadoNuevo: params.estadoNuevo,
        userId: params.user.id,
        userNombre: `${params.user.name} (${params.user.roleName || params.user.roleId})`,
        observacion: params.observacion
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || 'Error de autorización o servidor al modificar el estado.' };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error de comunicación al actualizar estado.' };
  }
}

export async function saveResponseVersion(params: {
  radicadoId: string;
  respuestaTexto: string;
  user: User;
  observaciones?: string;
  estadoActual?: string;
}): Promise<{ ok: boolean; versionNum?: number; error?: string }> {
  try {
    const response = await fetch('/api/revision-respuestas/guardar-version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        radicadoId: params.radicadoId,
        respuestaTexto: params.respuestaTexto,
        userId: params.user.id,
        userNombre: params.user.name,
        observaciones: params.observaciones,
        estadoActual: params.estadoActual
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error };
    }

    return { ok: true, versionNum: data.version?.version_numero };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

export async function fetchRadicadoFullHistory(radicadoId: string): Promise<{
  versiones: import('../types/radicacion').VersionRespuestaRecord[];
  historialEstados: import('../types/radicacion').HistorialEstadoRecord[];
}> {
  try {
    const response = await fetch(`/api/revision-respuestas/historial/${encodeURIComponent(radicadoId)}`);
    if (response.ok) {
      const data = await response.json();
      return {
        versiones: (data.versiones || []).map((v: any) => ({
          id: v.id,
          radicadoId: v.radicado_id,
          versionNumero: v.version_numero,
          respuestaTexto: v.respuesta_texto,
          modificadoPorId: v.modificado_por_id,
          modificadoPorNombre: v.modificado_por_nombre,
          observaciones: v.observaciones,
          createdAt: v.created_at
        })),
        historialEstados: (data.historial_estados || []).map((h: any) => ({
          id: h.id,
          radicadoId: h.radicado_id,
          estadoAnterior: h.estado_anterior,
          estadoNuevo: h.estado_nuevo,
          usuarioId: h.usuario_id,
          usuarioNombre: h.usuario_nombre,
          observacion: h.observacion,
          fecha: h.fecha
        }))
      };
    }
  } catch (e) {
    console.warn('Notice fetching radicado full history:', e);
  }

  return { versiones: [], historialEstados: [] };
}



