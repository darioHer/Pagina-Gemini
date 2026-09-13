import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  ShieldCheck, 
  Settings, 
  History, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Mail,
  Bot,
  FileText,
  FileCheck,
  Clock,
  CheckCheck,
  ShieldAlert
} from 'lucide-react';
import type { User, Role, UserStatus, DashboardMetrics, SystemAIConfig, AuditLog } from '../types/radicacion';
import { 
  fetchUsersList, 
  updateUserRole, 
  updateUserStatus, 
  fetchRolesList, 
  createNewRole,
  fetchDashboardMetrics,
  fetchSystemAIConfig,
  updateSystemAIConfig,
  fetchAuditLogs,
  logAuditEvent
} from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';
import { OcrScannerModule } from './OcrScannerModule';
import { GroqDraftGeneratorModule } from './GroqDraftGeneratorModule';
import { HumanReviewValidationModule } from './HumanReviewValidationModule';

export const AdminPanelPage: React.FC = () => {
  const { user: currentUser, resetPassword } = useAuth();

  // Active admin tab: 'dashboard' | 'usuarios' | 'roles' | 'config-ia' | 'ocr-gemini' | 'groq-rag' | 'validacion-emision' | 'auditoria'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'usuarios' | 'roles' | 'config-ia' | 'ocr-gemini' | 'groq-rag' | 'validacion-emision' | 'auditoria'>('dashboard');



  // Loading & notification states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 1. Dashboard Metrics State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // 2. Users Management State
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<UserStatus | 'todos'>('todos');

  // 3. Roles & Permissions State
  const [roles, setRoles] = useState<Role[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [newRoleId, setNewRoleId] = useState<string>('');
  const [newRoleNombre, setNewRoleNombre] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');
  const [selectedPermisos, setSelectedPermisos] = useState<string[]>(['radicar_pqr', 'ver_mis_radicados']);

  // 4. System AI Config State
  const [aiConfig, setAiConfig] = useState<SystemAIConfig>({
    geminiModel: 'gemini-1.5-flash',
    groqModel: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 2048,
    systemPrompt: 'Eres un asistente oficial de la Alcaldía Municipal especializado en normativas locales y atención ciudadana.'
  });
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // 5. Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Available system permissions
  const availablePermissions = [
    { id: 'admin_total', nombre: 'Acceso Total Administrador', desc: 'Permiso supremo de administración' },
    { id: 'gestionar_usuarios', nombre: 'Gestionar Usuarios', desc: 'Activar, desactivar y editar roles' },
    { id: 'gestionar_roles', nombre: 'Gestionar Roles', desc: 'Crear roles y asignar permisos' },
    { id: 'gobernar_normativas', nombre: 'Gobernanza de Normativas', desc: 'Gestión de leyes y decretos' },
    { id: 'revisar_radicados', nombre: 'Revisar Radicados', desc: 'Revisión técnica de peticiones' },
    { id: 'aprobar_radicados', nombre: 'Aprobar Respuestas', desc: 'Autorización y firma de respuestas' },
    { id: 'ver_todos_radicados', nombre: 'Ver Todos los Radicados', desc: 'Consulta global de PQRS' },
    { id: 'responder_pqr', nombre: 'Responder PQRS', desc: 'Redacción de respuestas oficiales' },
    { id: 'radicar_pqr', nombre: 'Radicar Peticiones', desc: 'Presentar nuevas PQRS' },
    { id: 'ver_mis_radicados', nombre: 'Ver Mis Radicados', desc: 'Consulta del historial propio' }
  ];

  const isAdmin = currentUser?.roleId === 'admin' || currentUser?.roleId === 'admin_municipal' || currentUser?.permissions?.includes('gestionar_usuarios') || currentUser?.permissions?.includes('admin_total');

  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [metricsData, fetchedUsers, fetchedRoles, fetchedConfig, logs] = await Promise.all([
        fetchDashboardMetrics(),
        fetchUsersList({
          searchQuery: searchQuery,
          roleId: selectedRoleFilter,
          estado: selectedStatusFilter
        }),
        fetchRolesList(),
        fetchSystemAIConfig(),
        fetchAuditLogs()
      ]);

      setMetrics(metricsData);
      setUsers(fetchedUsers);
      setRoles(fetchedRoles);
      setAiConfig(fetchedConfig);
      setAuditLogs(logs);
    } catch (e: any) {
      setError('Error al cargar la información del panel administrativo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllData();
    }
  }, [isAdmin, selectedRoleFilter, selectedStatusFilter]);

  // Handler for User Role change
  const handleRoleChange = async (userId: string, targetUserEmail: string, currentRoleId: string, newRoleId: string) => {
    if (!currentUser) return;
    setError(null);
    setSuccess(null);

    const ok = await updateUserRole(userId, newRoleId);
    if (ok) {
      setSuccess(`Rol del usuario ${targetUserEmail} actualizado a ${newRoleId}.`);
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const roleObj = roles.find((r) => r.id === newRoleId);
            return { ...u, roleId: newRoleId, roleName: roleObj?.nombre || newRoleId };
          }
          return u;
        })
      );

      await logAuditEvent({
        accion: 'CAMBIO_ROL_USUARIO',
        elementoModificado: targetUserEmail,
        valorAnterior: currentRoleId,
        valorNuevo: newRoleId,
        user: currentUser
      });

      const updatedLogs = await fetchAuditLogs();
      setAuditLogs(updatedLogs);
    } else {
      setError('Error al actualizar el rol en Supabase.');
    }
  };

  // Handler for User Status toggle
  const handleStatusToggle = async (userId: string, targetUserEmail: string, currentStatus: UserStatus) => {
    if (!currentUser) return;
    setError(null);
    setSuccess(null);

    const nextStatus: UserStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    const ok = await updateUserStatus(userId, nextStatus);
    if (ok) {
      setSuccess(`Estado del usuario ${targetUserEmail} cambiado a ${nextStatus.toUpperCase()}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, estado: nextStatus } : u))
      );

      await logAuditEvent({
        accion: nextStatus === 'inactivo' ? 'DESACTIVACION_USUARIO' : 'ACTIVACION_USUARIO',
        elementoModificado: targetUserEmail,
        valorAnterior: currentStatus,
        valorNuevo: nextStatus,
        user: currentUser
      });

      const [updatedLogs, updatedMetrics] = await Promise.all([fetchAuditLogs(), fetchDashboardMetrics()]);
      setAuditLogs(updatedLogs);
      setMetrics(updatedMetrics);
    } else {
      setError('Error al modificar el estado del usuario.');
    }
  };

  // Handler to Send Reset Password Email via Supabase Auth
  const handleSendResetPassword = async (targetEmail: string) => {
    if (!currentUser) return;
    setError(null);
    setSuccess(null);

    try {
      await resetPassword(targetEmail);
      setSuccess(`Correo de recuperación de contraseña enviado exitosamente a ${targetEmail}.`);

      await logAuditEvent({
        accion: 'SOLICITUD_RECUPERACION_PASSWORD_ADMIN',
        elementoModificado: targetEmail,
        valorAnterior: 'N/A',
        valorNuevo: 'Enlace enviado vía Supabase Auth',
        user: currentUser
      });

      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch (e: any) {
      setError(`Error al enviar recuperación: ${e.message}`);
    }
  };

  // Handler for Creating New Role
  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!newRoleNombre.trim() || !newRoleDesc.trim()) {
      setError('Nombre y descripción son campos obligatorios.');
      return;
    }

    const roleId = newRoleId.trim() || newRoleNombre.toLowerCase().replace(/\s+/g, '_');
    const ok = await createNewRole({
      id: roleId,
      nombre: newRoleNombre.trim(),
      descripcion: newRoleDesc.trim(),
      permisos: selectedPermisos
    });

    if (ok) {
      setSuccess(`Nuevo rol "${newRoleNombre}" creado correctamente.`);
      setIsRoleModalOpen(false);
      setNewRoleId('');
      setNewRoleNombre('');
      setNewRoleDesc('');

      await logAuditEvent({
        accion: 'CREACION_NUEVO_ROL',
        elementoModificado: `Rol: ${roleId}`,
        valorAnterior: 'Inexistente',
        valorNuevo: `Permisos: [${selectedPermisos.join(', ')}]`,
        user: currentUser
      });

      const [fetchedRoles, logs] = await Promise.all([fetchRolesList(), fetchAuditLogs()]);
      setRoles(fetchedRoles);
      setAuditLogs(logs);
    } else {
      setError('Error al registrar el rol en la base de datos.');
    }
  };

  // Handler for Updating AI Config
  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingConfig(true);
    setError(null);
    setSuccess(null);

    const ok = await updateSystemAIConfig(aiConfig, currentUser);
    setSavingConfig(false);

    if (ok) {
      setSuccess('Configuración de modelos de IA (Gemini / Groq) actualizada correctamente.');
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } else {
      setError('Error al guardar la configuración del sistema.');
    }
  };

  // RESTRICTED ACCESS SCREEN
  if (!isAdmin) {
    return (
      <div style={{ maxWidth: '700px', margin: '3rem auto', padding: '2rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #fecaca', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
          <ShieldAlert size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>
          Acceso Restringido • Requiere Rol Administrador
        </h2>
        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          No tienes permisos suficientes para acceder al Panel Administrativo de la Alcaldía. Esta sección está protegida mediante Row Level Security (RLS) en Supabase.
        </p>
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', color: '#6b7280', textAlign: 'left', marginBottom: '1.5rem' }}>
          <div><strong>Tu ID de Usuario:</strong> {currentUser?.id || 'Anónimo'}</div>
          <div><strong>Tu Rol Actual:</strong> {currentUser?.roleName || 'Usuario Normal'} ({currentUser?.roleId || 'sin_rol'})</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      
      {/* Header del Panel Administrativo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#1e293b', color: '#f8fafc', padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <ShieldCheck size={16} color="#38bdf8" />
            <span>Panel de Control Administrativo Oficial</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Centro de Mando & Control de IA
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Gestión integral de usuarios, políticas de seguridad RLS, configuración de Gemini/Groq y trazabilidad.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllData}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <RefreshCw size={16} className={loading ? 'spinner-icon' : ''} />
          <span>{loading ? 'Actualizando...' : 'Refrescar Datos'}</span>
        </button>
      </div>

      {/* Alertas Globales de Error / Éxito */}
      {error && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs de Navegación del Panel */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'dashboard' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'dashboard' ? '#ffffff' : 'transparent',
            color: activeTab === 'dashboard' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart3 size={18} />
          <span>1. Dashboard</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'usuarios' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'usuarios' ? '#ffffff' : 'transparent',
            color: activeTab === 'usuarios' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('usuarios')}
        >
          <Users size={18} />
          <span>2. Usuarios</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'roles' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'roles' ? '#ffffff' : 'transparent',
            color: activeTab === 'roles' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('roles')}
        >
          <ShieldCheck size={18} />
          <span>3. Roles y Permisos</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'config-ia' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'config-ia' ? '#ffffff' : 'transparent',
            color: activeTab === 'config-ia' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('config-ia')}
        >
          <Settings size={18} />
          <span>4. Configuración IA</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'ocr-gemini' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'ocr-gemini' ? '#ffffff' : 'transparent',
            color: activeTab === 'ocr-gemini' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('ocr-gemini')}
        >
          <Sparkles size={18} color="#0284c7" />
          <span>5. OCR Gemini</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'groq-rag' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'groq-rag' ? '#ffffff' : 'transparent',
            color: activeTab === 'groq-rag' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('groq-rag')}
        >
          <Bot size={18} color="#9333ea" />
          <span>6. Borradores Groq</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'validacion-emision' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'validacion-emision' ? '#ffffff' : 'transparent',
            color: activeTab === 'validacion-emision' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('validacion-emision')}
        >
          <UserCheck size={18} color="#059669" />
          <span>7. Validación & Emisión</span>
        </button>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            borderBottom: activeTab === 'auditoria' ? '3px solid #2563eb' : '3px solid transparent',
            backgroundColor: activeTab === 'auditoria' ? '#ffffff' : 'transparent',
            color: activeTab === 'auditoria' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
          onClick={() => setActiveTab('auditoria')}
        >
          <History size={18} />
          <span>8. Auditoría</span>
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑA OCR GEMINI */}
      {activeTab === 'ocr-gemini' && (
        <OcrScannerModule />
      )}

      {/* CONTENIDO DE PESTAÑA BORRADORES GROQ */}
      {activeTab === 'groq-rag' && (
        <GroqDraftGeneratorModule />
      )}

      {/* CONTENIDO DE PESTAÑA VALIDACIÓN Y EMISIÓN */}
      {activeTab === 'validacion-emision' && (
        <HumanReviewValidationModule />
      )}




      {/* CONTENIDO DE PESTAÑA 1: DASHBOARD METRICAS */}
      {activeTab === 'dashboard' && (
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem' }}>
            Resumen General de Métricas del Sistema
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            
            {/* Metric 1 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Usuarios Registrados</span>
                <Users size={20} color="#2563eb" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', marginTop: '0.5rem' }}>
                {metrics?.totalUsers || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem', fontWeight: 600 }}>
                Sincronizados con Supabase Auth
              </div>
            </div>

            {/* Metric 2 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Usuarios Activos</span>
                <UserCheck size={20} color="#16a34a" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#15803d', marginTop: '0.5rem' }}>
                {metrics?.activeUsers || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Cuentas habilitadas para operar
              </div>
            </div>

            {/* Metric 3 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Usuarios Inactivos</span>
                <UserX size={20} color="#dc2626" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#b91c1c', marginTop: '0.5rem' }}>
                {metrics?.inactiveUsers || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', fontWeight: 600 }}>
                Acceso suspendido por admin
              </div>
            </div>

            {/* Metric 4 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Total de Radicados</span>
                <FileText size={20} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#5b21b6', marginTop: '0.5rem' }}>
                {metrics?.totalRadicados || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Documentos PQRS registrados
              </div>
            </div>

            {/* Metric 5 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Radicados Pendientes</span>
                <Clock size={20} color="#d97706" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#b45309', marginTop: '0.5rem' }}>
                {metrics?.radicadosPendientes || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                En proceso de asignación
              </div>
            </div>

            {/* Metric 6 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Radicados en Revisión</span>
                <FileCheck size={20} color="#0284c7" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0369a1', marginTop: '0.5rem' }}>
                {metrics?.radicadosEnRevision || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                En validación técnica de respuesta
              </div>
            </div>

            {/* Metric 7 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Radicados Aprobados</span>
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#15803d', marginTop: '0.5rem' }}>
                {metrics?.radicadosAprobados || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Respuestas autorizadas
              </div>
            </div>

            {/* Metric 8 */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Radicados Emitidos</span>
                <CheckCheck size={20} color="#0f766e" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f766e', marginTop: '0.5rem' }}>
                {metrics?.radicadosEmitidos || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Notificados oficialmente
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 2: USUARIOS */}
      {activeTab === 'usuarios' && (
        <div>
          {/* Bar de Filtros y Búsqueda */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <form onSubmit={(e) => { e.preventDefault(); loadAllData(); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Buscar por Nombre o Correo</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Ej: Carlos o correo@..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Filtrar por Rol</label>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
                >
                  <option value="todos">Todos los Roles ({roles.length})</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Filtrar por Estado</label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="activo">🟢 Activos</option>
                  <option value="inactivo">🔴 Inactivos</option>
                </select>
              </div>

              <div>
                <button type="submit" style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <Filter size={16} />
                  <span>Aplicar Filtros</span>
                </button>
              </div>
            </form>
          </div>

          {/* Tabla de Usuarios */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Usuario / Titular</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Correo Electrónico</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Rol Asignado</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Recuperación Contraseña</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acción Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <img src={u.avatar} alt={u.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {u.id.slice(0, 16)}...</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 500 }}>{u.email}</td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <select
                          value={u.roleId}
                          onChange={(e) => handleRoleChange(u.id, u.email, u.roleId, e.target.value)}
                          style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 600, backgroundColor: '#f8fafc' }}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.nombre}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: u.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: u.estado === 'activo' ? '#15803d' : '#b91c1c' }}>
                          {u.estado === 'activo' ? <UserCheck size={13} /> : <UserX size={13} />}
                          <span>{u.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => handleSendResetPassword(u.email)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          <Mail size={13} />
                          <span>Enviar Enlace Reset</span>
                        </button>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(u.id, u.email, u.estado)}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', backgroundColor: u.estado === 'activo' ? '#fef2f2' : '#f0fdf4', color: u.estado === 'activo' ? '#dc2626' : '#16a34a' }}
                        >
                          {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 3: ROLES Y PERMISOS */}
      {activeTab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Matriz de Roles y Permisos Granulares
            </h2>
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <Plus size={16} />
              <span>Crear Nuevo Rol</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {roles.map((r) => (
              <div key={r.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{r.nombre}</h3>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#475569', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                    {r.id}
                  </span>
                </div>

                <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>
                  {r.descripcion}
                </p>

                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                  Permisos Asignados ({r.permisos.length}):
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {r.permisos.map((p) => (
                    <span key={p} style={{ fontSize: '0.72rem', backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #dbeafe' }}>
                      ✓ {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 4: CONFIGURACIÓN IA */}
      {activeTab === 'config-ia' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          
          {/* Banner de Arquitectura de IA */}
          <div style={{ padding: '1rem 1.25rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#166534', fontSize: '0.95rem', marginBottom: '0.4rem' }}>
              <Sparkles size={18} color="#15803d" />
              <span>Arquitectura Oficial de Modelos & Separación de Responsabilidades</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.83rem', color: '#14532d', marginTop: '0.5rem' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #86efac' }}>
                <strong style={{ color: '#15803d' }}>📷 Google Gemini (Motor OCR Exclusivo):</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#334155' }}>
                  Utilizado <strong>únicamente</strong> para extraer texto e información estructurada de documentos adjuntos (PDFs e imágenes). <em>No genera respuestas normativas.</em>
                </p>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #86efac' }}>
                <strong style={{ color: '#c2410c' }}>⚡ Groq LLM (Generación RAG Exclusiva):</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#334155' }}>
                  Utilizado <strong>únicamente</strong> para redactar borradores de respuestas basados en la normativa legal recuperada desde Supabase.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveAIConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            
            {/* Gemini Config (OCR) */}
            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.75rem' }}>
                <Bot size={18} color="#4285F4" />
                <span>Google Gemini (Motor OCR Exclusivo)</span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Modelo Gemini para OCR *</label>
                <select
                  value={aiConfig.geminiModel}
                  onChange={(e) => setAiConfig({ ...aiConfig, geminiModel: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Recomendado para OCR ultrarrápido)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Alta precisión multimodal)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Modo de Extracción OCR</label>
                <select
                  value={aiConfig.geminiOcrMode || 'structured'}
                  onChange={(e) => setAiConfig({ ...aiConfig, geminiOcrMode: e.target.value as any })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
                >
                  <option value="structured">Estructurado JSON (Campos + Texto Plano)</option>
                  <option value="text">Texto Plano Completo</option>
                  <option value="vision">Reconocimiento Visual de Manuscritos</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Gemini API Key (Enmascarada en Servidor)
                </label>
                <input
                  type="text"
                  readOnly
                  value={aiConfig.geminiApiKeyMasked || 'AIza••••••••••••7F9A'}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#f1f5f9', color: '#475569', fontFamily: 'monospace', fontWeight: 600, marginBottom: '0.5rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                  🔒 Protegida mediante variable Server-Side <code>GEMINI_API_KEY</code>
                </span>
              </div>
            </div>

            {/* Groq Config (RAG LLM) */}
            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.75rem' }}>
                <Sparkles size={18} color="#ea580c" />
                <span>Groq LLM (Generación de Respuestas RAG)</span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Modelo Groq para Respuestas *</label>
                <select
                  value={aiConfig.groqModel}
                  onChange={(e) => setAiConfig({ ...aiConfig, groqModel: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
                >
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recomendado para lenguaje normativo)</option>
                  <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (Velocidad y contexto extenso)</option>
                  <option value="gemma2-9b-it">gemma2-9b-it (Modelo compacto)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Parámetro Top-P Sampling ({aiConfig.topP || 0.9})</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={aiConfig.topP || 0.9}
                  onChange={(e) => setAiConfig({ ...aiConfig, topP: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Groq API Key (Enmascarada en Servidor)
                </label>
                <input
                  type="text"
                  readOnly
                  value={aiConfig.groqApiKeyMasked || 'gsk_••••••••••••3K1L'}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#f1f5f9', color: '#475569', fontFamily: 'monospace', fontWeight: 600, marginBottom: '0.5rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                  🔒 Protegida mediante variable Server-Side <code>GROQ_API_KEY</code>
                </span>
              </div>
            </div>

            {/* Temperature & Max Tokens */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Temperatura de Generación ({aiConfig.temperature})
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={aiConfig.temperature}
                  onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>0.0 = Máxima rigurosidad legal / 1.0 = Mayor flexibilidad de redacción</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Máximo de Tokens de Respuesta
                </label>
                <input
                  type="number"
                  value={aiConfig.maxTokens}
                  onChange={(e) => setAiConfig({ ...aiConfig, maxTokens: parseInt(e.target.value) || 2048 })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* System Prompt */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                System Prompt Institucional para Groq RAG *
              </label>
              <textarea
                rows={4}
                value={aiConfig.systemPrompt}
                onChange={(e) => setAiConfig({ ...aiConfig, systemPrompt: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', lineHeight: '1.45' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingConfig}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                <CheckCircle2 size={18} />
                <span>{savingConfig ? 'Guardando Configuración...' : 'Guardar Parámetros de IA en Supabase'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 5: AUDITORÍA E HISTORIAL */}
      {activeTab === 'auditoria' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <History size={22} color="#7c3aed" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Historial de Auditoría & Trazabilidad</h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Registro inmutable de todas las operaciones administrativas, cambios de rol, desactivación de cuentas y modificaciones de configuración de IA.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha / Hora</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Usuario Administrador</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Acción Ejecutada</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Elemento Modificado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Valor Anterior</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Valor Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('es-CO')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                      {log.usuarioNombre}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
                        {log.accion}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#334155' }}>
                      {log.elementoModificado}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.8rem' }}>
                      {log.valorAnterior || 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>
                      {log.valorNuevo || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CREAR ROL NUEVO */}
      {isRoleModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRoleModalOpen(false)}>
          <div className="login-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            
            <div className="login-modal-header">
              <div className="login-modal-title-group">
                <div className="login-badge-institucional">
                  <Sparkles size={16} />
                  <span>Configuración Dinámica de Roles</span>
                </div>
                <h2 className="login-modal-title">Crear Nuevo Rol de Sistema</h2>
              </div>
            </div>

            <form onSubmit={handleCreateRoleSubmit} style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Nombre del Rol *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Auditor Externo"
                    value={newRoleNombre}
                    onChange={(e) => setNewRoleNombre(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Identificador Técnico (ID)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: auditor_externo (dejar vacío para auto-generar)"
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Descripción del Rol *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describa el propósito de este rol en la alcaldía..."
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    Asignar Permisos Granulares
                  </label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem' }}>
                    {availablePermissions.map((p) => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedPermisos.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermisos([...selectedPermisos, p.id]);
                            } else {
                              setSelectedPermisos(selectedPermisos.filter((item) => item !== p.id));
                            }
                          }}
                        />
                        <div>
                          <strong>{p.nombre}</strong> <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({p.id})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsRoleModalOpen(false)}
                    style={{ padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Guardar Nuevo Rol
                  </button>
                </div>

              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanelPage;
