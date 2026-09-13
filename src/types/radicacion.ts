export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google';
  documentId?: string;
  phone?: string;
  googleSubId?: string;
  roleId?: string;
  roleName?: string;
}

export type RadicacionMode = 'escrito' | 'pdf' | 'word';

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
  estado: 'En trámite' | 'Resuelto' | 'En revisión técnica';
  fechaRadicacion: string;
  plazoLegal: string;
  respuestaOficial: string;
  hashSeguridad: string;
  usuarioId?: string;
  proveedorAuth?: 'google';
}
