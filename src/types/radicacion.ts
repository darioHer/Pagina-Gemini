export type UserStatus = 'activo' | 'inactivo';

export interface Permission {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Role {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
  created_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'email';
  documentId?: string;
  phone?: string;
  googleSubId?: string;
  roleId: string;
  roleName?: string;
  estado: UserStatus;
  createdAt?: string;
  updatedAt?: string;
  permissions?: string[];
}

export interface UserFilter {
  searchQuery?: string;
  roleId?: string;
  estado?: UserStatus | 'todos';
}

export type RadicacionMode = 'escrito' | 'pdf' | 'word' | 'imagen';

export type TipoSolicitud = 
  | 'Derecho de Petición'
  | 'Queja'
  | 'Reclamo'
  | 'Sugerencia'
  | 'Solicitud de Información';

export interface ArchivoAdjunto {
  nombre: string;
  tipo: string;
  tamano: string;
  extension: string;
  previewUrl?: string;
}

export interface DocumentoRadicado {
  id: string;
  solicitante: string;
  emailSolicitante: string;
  cedulaSolicitante: string;
  telefonoSolicitante: string;
  categoria: string;
  tipoSolicitud: TipoSolicitud;
  modoRadicacion: RadicacionMode;
  asunto: string;
  descripcion: string;
  archivoAdjunto?: ArchivoAdjunto;
  estado: 'En trámite' | 'Resuelto' | 'En revisión técnica' | 'En revisión' | 'Aprobado' | 'Emitido';
  fechaRadicacion: string;
  plazoLegal: string;
  respuestaOficial: string;
  hashSeguridad: string;
  usuarioId?: string;
  proveedorAuth?: 'google' | 'email';
}

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalRadicados: number;
  radicadosPendientes: number;
  radicadosEnRevision: number;
  radicadosAprobados: number;
  radicadosEmitidos: number;
}

export interface SystemAIConfig {
  geminiModel: string;
  geminiApiKeyMasked?: string;
  geminiOcrMode?: 'text' | 'structured' | 'vision';
  groqModel: string;
  groqApiKeyMasked?: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  systemPrompt: string;
  geminiApiKeyConfigured?: boolean;
  groqApiKeyConfigured?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AuditLog {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  elementoModificado: string;
  valorAnterior?: string;
  valorNuevo?: string;
  createdAt: string;
}

export type OcrStatus = 'RECIBIDO' | 'OCR_EN_PROCESO' | 'OCR_COMPLETADO' | 'OCR_ERROR';

export interface OcrExtractionResult {
  radicado: string | null;
  fecha: string | null;
  entidad: string | null;
  remitente: string | null;
  destinatario: string | null;
  asunto: string | null;
  peticion: string | null;
  normas_mencionadas: string[];
  fechas_importantes?: string[];
  informacion_adicional?: string | null;
  texto_extraido: string | null;
}

export interface OcrDocumentRecord {
  id: string;
  usuario_id?: string | null;
  usuario_email?: string | null;
  nombre_archivo: string;
  tipo_mime: string;
  tamano_bytes: number;
  url_archivo?: string | null;
  estado_ocr: OcrStatus;
  resultado_json?: OcrExtractionResult | null;
  texto_extraido?: string | null;
  error_mensaje?: string | null;
  created_at: string;
  updated_at?: string;
}

export type TipoNorma = 
  | 'Leyes'
  | 'Decretos'
  | 'Resoluciones'
  | 'Acuerdos'
  | 'Circulares'
  | 'Conceptos'
  | 'Otras normas';

export interface NormativaCompleta {
  id: string;
  tipo_norma: TipoNorma;
  numero: string;
  anio: number;
  titulo: string;
  entidad: string;
  fecha: string;
  contenido: string;
  articulos: string;
  estado: 'Vigente' | 'Derogada' | 'Modificada';
  categoria?: string;
  resumen_ejecutivo?: string;
  fecha_actualizacion?: string;
}

export type DraftStatus = 'CONSULTANDO_NORMATIVA' | 'BORRADOR_GENERADO' | 'BORRADOR' | 'EN_REVISION';

export interface BorradorRespuestaRecord {
  id: string;
  radicado_id?: string | null;
  usuario_id?: string | null;
  usuario_email?: string | null;
  modelo_utilizado: string;
  normativa_utilizada: Array<{
    id: string;
    titulo: string;
    tipo_norma: string;
    numero: string;
  }>;
  prompt_configuracion: {
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
  respuesta_borrador: string;
  estado: DraftStatus;
  created_at: string;
  updated_at?: string;
}

export type EstadoRadicadoFlujo = 
  | 'RECIBIDO'
  | 'OCR_COMPLETADO'
  | 'BORRADOR_GENERADO'
  | 'EN_REVISION'
  | 'CORRECCION_SOLICITADA'
  | 'APROBADO'
  | 'EMITIDO';

export interface VersionRespuestaRecord {
  id: string;
  radicadoId: string;
  versionNumero: number;
  respuestaTexto: string;
  modificadoPorId?: string;
  modificadoPorNombre?: string;
  observaciones?: string;
  createdAt: string;
}

export interface HistorialEstadoRecord {
  id: string;
  radicadoId: string;
  estadoAnterior: string;
  estadoNuevo: string;
  usuarioId?: string;
  usuarioNombre?: string;
  observacion?: string;
  fecha: string;
}



