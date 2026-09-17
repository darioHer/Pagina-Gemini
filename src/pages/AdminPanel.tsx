import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getAllUsers,
  updateUserRole,
  updateUserVerification,
  updateUserPassword,
  getAllRoles,
  getAppConfig,
  saveAppConfig,
  getPendingValidations,
  approveResponse,
  rejectPeticion,
  type AdminUser,
  type AppConfig,
  type PeticionAdmin,
  type RolItem,
} from '../services/adminService';
import { generateOfficialResponse } from '../services/aiService';

type AdminTab = 'usuarios' | 'configuracion' | 'validaciones';

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  
  // Roles de administración total
  const isSuperAdmin = user && (user.roleId === 'admin' || user.roleId === 'administrador' || user.roleId === 'admin_municipal');
  // Roles autorizados para gestión y validación institucional
  const isAuthorizedStaff = user && (
    isSuperAdmin || 
    user.roleId === 'funcionario_alcaldia' || 
    user.roleId === 'analista_pqrs' || 
    user.roleId === 'secretario'
  );

  const [activeTab, setActiveTab] = useState<AdminTab>(isSuperAdmin ? 'usuarios' : 'validaciones');

  useEffect(() => {
    if (!isSuperAdmin && isAuthorizedStaff) {
      setActiveTab('validaciones');
    }
  }, [isSuperAdmin, isAuthorizedStaff]);

  // Guard de acceso
  if (!user || !isAuthorizedStaff) {
    return (
      <div className="admin-access-denied">
        <div className="admin-denied-card">
          <div className="admin-denied-icon">🔒</div>
          <h2>Acceso Restringido</h2>
          <p>Esta sección es exclusiva para funcionarios autorizados y administradores del sistema municipal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-info">
          <h1>Panel de Gestión y Gobernanza</h1>
          <p>Control de roles, credenciales, validación institucional de radicados y configuración de IA</p>
        </div>
        <div className="admin-badge">
          <span className="admin-badge-icon">🛡️</span>
          <span>{user.name} ({user.roleName || user.roleId})</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {isSuperAdmin && (
          <>
            <button
              className={`admin-tab ${activeTab === 'usuarios' ? 'active' : ''}`}
              onClick={() => setActiveTab('usuarios')}
            >
              <span>👥</span> Gobernanza de Usuarios y Roles
            </button>
            <button
              className={`admin-tab ${activeTab === 'configuracion' ? 'active' : ''}`}
              onClick={() => setActiveTab('configuracion')}
            >
              <span>🔑</span> APIs e Inteligencia Artificial
            </button>
          </>
        )}
        <button
          className={`admin-tab ${activeTab === 'validaciones' ? 'active' : ''}`}
          onClick={() => setActiveTab('validaciones')}
        >
          <span>✅</span> Validación de Respuestas (Radicados)
        </button>
      </div>

      {/* Tab Content */}
      <div className="admin-content">
        {activeTab === 'usuarios' && isSuperAdmin && <TabUsuarios />}
        {activeTab === 'configuracion' && isSuperAdmin && <TabConfiguracion />}
        {activeTab === 'validaciones' && <TabValidaciones currentUser={user} />}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  TAB 1: USUARIOS Y GOBERNANZA DE ROLES
// ─────────────────────────────────────────────
const TabUsuarios: React.FC = () => {
  const { user, switchRole } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('todos');

  // Modal para cambio de contraseña / credencial
  const [passwordModalUser, setPasswordModalUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersData, rolesData] = await Promise.all([getAllUsers(), getAllRoles()]);
    setUsers(usersData);
    setRoles(rolesData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    setSavingId(userId);
    const ok = await updateUserRole(userId, newRoleId);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, role_id: newRoleId, role_nombre: roles.find(r => r.id === newRoleId)?.nombre || newRoleId }
        : u
      ));
      // If the edited user is the current authenticated user, update the session role
      if (user && user.id === userId) {
        const roleDisplayName = roles.find(r => r.id === newRoleId)?.nombre || newRoleId;
        await switchRole(newRoleId, roleDisplayName);
      }
      showToast('Rol actualizado y sincronizado en Supabase.', 'ok');
    } else {
      showToast('Error al actualizar el rol. Verifica los permisos en Supabase.', 'err');
    }
    setSavingId(null);
  };

  const handleToggleVerification = async (u: AdminUser) => {
    const nextState = !u.verificado;
    setSavingId(u.id);
    const ok = await updateUserVerification(u.id, nextState);
    if (ok) {
      setUsers(prev => prev.map(item => item.id === u.id ? { ...item, verificado: nextState } : item));
      showToast(nextState ? `Usuario ${u.nombre} verificado en Supabase.` : `Usuario ${u.nombre} marcado como pendiente de verificación.`, 'ok');
    } else {
      showToast('Error al cambiar estado de verificación en Supabase.', 'err');
    }
    setSavingId(null);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (newPassword.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'err');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden.', 'err');
      return;
    }

    setPasswordSaving(true);
    const res = await updateUserPassword(passwordModalUser.id, passwordModalUser.email, newPassword);
    setPasswordSaving(false);

    if (res.success) {
      showToast(res.message, 'ok');
      setPasswordModalUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setUsers(prev => prev.map(u => u.id === passwordModalUser.id ? { ...u, password_set: true } : u));
    } else {
      showToast(res.message, 'err');
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.cedula && u.cedula.includes(searchTerm));
    const matchesRole = filterRole === 'todos' || u.role_id === filterRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
        <p>Cargando usuarios desde Supabase...</p>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Modal de cambio de contraseña */}
      {passwordModalUser && (
        <div className="admin-modal-backdrop" onClick={() => setPasswordModalUser(null)}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>🔑 Cambiar Contraseña / Credencial</h3>
              <button 
                className="admin-btn-close" 
                onClick={() => setPasswordModalUser(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSavePassword}>
              <div className="admin-modal-body">
                <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1rem' }}>
                  Establecer una nueva contraseña de acceso para el usuario <strong>{passwordModalUser.nombre}</strong> (<code>{passwordModalUser.email}</code>).
                  Este cambio se registrará en la base de datos Supabase por gobernanza.
                </p>

                <div className="admin-field-group">
                  <label>Nueva Contraseña (mínimo 6 caracteres) *</label>
                  <input
                    type="password"
                    className="admin-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                </div>

                <div className="admin-field-group">
                  <label>Confirmar Nueva Contraseña *</label>
                  <input
                    type="password"
                    className="admin-input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn-action"
                  onClick={() => setPasswordModalUser(null)}
                  disabled={passwordSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn-action btn-verify"
                  style={{ background: '#003399', color: '#fff', border: 'none', padding: '0.5rem 1rem' }}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Actualizando en Supabase...' : 'Guardar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-section-header">
        <div>
          <h2>Gobernanza de Usuarios y Roles</h2>
          <p>{users.length} usuarios registrados en el sistema municipal</p>
        </div>
        <button className="admin-btn-refresh" onClick={load}>↻ Actualizar</button>
      </div>

      {/* Barra de Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }} className="admin-search-bar">
          <input
            type="text"
            placeholder="Buscar por nombre, correo o cédula..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', marginBottom: 0 }}
          />
        </div>
        <div>
          <select
            className="admin-role-select"
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            style={{ height: '100%', padding: '0.6rem 0.9rem' }}
          >
            <option value="todos">Todos los Roles ({users.length})</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>
                {r.nombre} ({users.filter(u => u.role_id === r.id).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Cédula</th>
              <th>Verificación</th>
              <th>Rol Actual</th>
              <th>Cambiar Rol (Supabase)</th>
              <th>Acciones Gobernanza</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty-row">No se encontraron usuarios</td>
              </tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="admin-user-cell">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.nombre} className="admin-user-avatar" />
                      ) : (
                        <div className="admin-user-initials">
                          {u.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <strong>{u.nombre || '—'}</strong>
                        {u.created_at && (
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            Reg: {new Date(u.created_at).toLocaleDateString('es-CO')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="admin-email-cell">{u.email}</td>
                  <td>{u.cedula || '—'}</td>
                  <td>
                    {u.verificado ? (
                      <span className="admin-verified-badge yes" title="Usuario verificado y habilitado">
                        ✓ Verificado
                      </span>
                    ) : (
                      <span className="admin-verified-badge no" title="Pendiente de verificación por la gobernanza">
                        ⏳ Pendiente
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`admin-role-badge role-${u.role_id}`}>
                      {u.role_nombre || u.role_id}
                    </span>
                  </td>
                  <td>
                    <select
                      className="admin-role-select"
                      value={u.role_id}
                      disabled={savingId === u.id}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                    {savingId === u.id && <span className="admin-saving-indicator">Guardando...</span>}
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      {/* Botón Verificación de Usuario */}
                      <button
                        type="button"
                        className={`admin-btn-action ${u.verificado ? 'btn-unverify' : 'btn-verify'}`}
                        disabled={savingId === u.id}
                        onClick={() => handleToggleVerification(u)}
                        title={u.verificado ? 'Desmarcar verificación' : 'Verificar usuario en Supabase'}
                      >
                        {u.verificado ? 'Desverificar' : '✓ Verificar'}
                      </button>

                      {/* Botón Cambiar Contraseña */}
                      <button
                        type="button"
                        className="admin-btn-action btn-password"
                        onClick={() => {
                          setPasswordModalUser(u);
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        title="Cambiar contraseña en Supabase"
                      >
                        🔑 Contraseña
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-info-box">
        <strong>🛡️ Gobernanza de Roles y Seguridad:</strong> El administrador tiene la facultad de modificar los roles de los usuarios (ciudadano general, funcionario, analista, secretario o admin), verificar sus cuentas tras el registro y restablecer contraseñas de acceso. Todas las operaciones se persisten directamente en Supabase.
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  TAB 2: CONFIGURACIÓN API (GEMINI + GROK)
// ─────────────────────────────────────────────
const TabConfiguracion: React.FC = () => {
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const data = await getAppConfig();
      setConfigs(data);
      setLoading(false);
    })();
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleChange = (clave: string, valor: string) => {
    setConfigs(prev => prev.map(c => c.clave === clave ? { ...c, valor } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveAppConfig(configs);
    setSaving(false);
    showToast(
      ok ? 'Configuración guardada correctamente en Supabase.' : 'Error al guardar. Verifica que la tabla configuracion_sistema exista.',
      ok ? 'ok' : 'err'
    );
  };

  const getVal = (clave: string) => configs.find(c => c.clave === clave)?.valor || '';
  const toggleKey = (clave: string) => setShowKeys(prev => ({ ...prev, [clave]: !prev[clave] }));

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
        <p>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Gemini Section */}
      <div className="admin-config-section">
        <div className="admin-config-section-header">
          <div className="admin-config-icon gemini-icon">✨</div>
          <div>
            <h3>Google Gemini — OCR</h3>
            <p>Solo se usa para extraer texto de imágenes (PNG, JPG) y documentos PDF.</p>
          </div>
        </div>

        <div className="admin-field-group">
          <label>API Key de Gemini</label>
          <div className="admin-key-input-row">
            <input
              type={showKeys['gemini_api_key'] ? 'text' : 'password'}
              className="admin-input"
              value={getVal('gemini_api_key')}
              placeholder="AIza..."
              onChange={e => handleChange('gemini_api_key', e.target.value)}
            />
            <button className="admin-toggle-key" onClick={() => toggleKey('gemini_api_key')}>
              {showKeys['gemini_api_key'] ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="admin-field-hint">Obtén tu key en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a></p>
        </div>

        <div className="admin-pipeline-notice">
          <span>📄 Archivo (PNG/JPG/PDF)</span>
          <span className="arrow">→</span>
          <span>✨ Gemini OCR</span>
          <span className="arrow">→</span>
          <span>📝 Texto extraído</span>
          <span className="arrow">→</span>
          <span>🤖 Grok</span>
        </div>
      </div>

      {/* Grok Section */}
      <div className="admin-config-section">
        <div className="admin-config-section-header">
          <div className="admin-config-icon grok-icon">🤖</div>
          <div>
            <h3>xAI Grok — Consulta Normativas + Respuesta</h3>
            <p>Consulta normativas en Supabase y genera la respuesta oficial institucional.</p>
          </div>
        </div>

        <div className="admin-field-group">
          <label>API Key de Grok (xAI)</label>
          <div className="admin-key-input-row">
            <input
              type={showKeys['grok_api_key'] ? 'text' : 'password'}
              className="admin-input"
              value={getVal('grok_api_key')}
              placeholder="xai-..."
              onChange={e => handleChange('grok_api_key', e.target.value)}
            />
            <button className="admin-toggle-key" onClick={() => toggleKey('grok_api_key')}>
              {showKeys['grok_api_key'] ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="admin-field-hint">Obtén tu key en <a href="https://console.x.ai" target="_blank" rel="noreferrer">console.x.ai</a></p>
        </div>

        <div className="admin-field-group">
          <label>Rol del Sistema (System Prompt)</label>
          <textarea
            className="admin-textarea"
            value={getVal('grok_system_prompt')}
            rows={5}
            placeholder="Eres un asistente oficial de la Alcaldía..."
            onChange={e => handleChange('grok_system_prompt', e.target.value)}
          />
          <p className="admin-field-hint">Define cómo se comporta Grok al generar respuestas. Puedes incluir instrucciones de tono, formato y citas normativas.</p>
        </div>

        <div className="admin-fields-row">
          <div className="admin-field-group">
            <label>Temperatura ({getVal('grok_temperature') || '0.25'})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={getVal('grok_temperature') || '0.25'}
              onChange={e => handleChange('grok_temperature', e.target.value)}
              className="admin-slider"
            />
            <div className="admin-slider-labels">
              <span>0.0 — Preciso / Legal</span>
              <span>1.0 — Creativo</span>
            </div>
          </div>

          <div className="admin-field-group">
            <label>Máximo de tokens</label>
            <input
              type="number"
              className="admin-input"
              min="256"
              max="8192"
              step="128"
              value={getVal('grok_max_tokens') || '2048'}
              onChange={e => handleChange('grok_max_tokens', e.target.value)}
            />
            <p className="admin-field-hint">Longitud máxima de la respuesta generada.</p>
          </div>
        </div>
      </div>

      {/* OpenRouter Section */}
      <div className="admin-config-section">
        <div className="admin-config-section-header">
          <div className="admin-config-icon" style={{ background: '#ecfdf5' }}>🌐</div>
          <div>
            <h3>OpenRouter — Proveedor Alternativo / Respaldo</h3>
            <p>Conexión adicional para modelos Grok, LLaMA o Claude en caso de alta concurrencia.</p>
          </div>
        </div>

        <div className="admin-field-group">
          <label>API Key de OpenRouter</label>
          <div className="admin-key-input-row">
            <input
              type={showKeys['openrouter_api_key'] ? 'text' : 'password'}
              className="admin-input"
              value={getVal('openrouter_api_key')}
              placeholder="sk-or-v1-..."
              onChange={e => handleChange('openrouter_api_key', e.target.value)}
            />
            <button className="admin-toggle-key" onClick={() => toggleKey('openrouter_api_key')}>
              {showKeys['openrouter_api_key'] ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="admin-field-hint">Obtén o gestiona tu key en <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a></p>
        </div>
      </div>

      <div className="admin-save-row">
        <button
          className="admin-btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '⏳ Guardando...' : '💾 Guardar Configuración'}
        </button>
      </div>

      <div className="admin-info-box">
        <strong>⚠️ Seguridad:</strong> Las claves API se almacenan en la tabla <code>configuracion_sistema</code> de Supabase.
        Asegúrate de que las políticas RLS limiten el acceso solo a usuarios con rol administrador.
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  TAB 3: VALIDACIÓN DE RESPUESTAS
// ─────────────────────────────────────────────
interface TabValidacionesProps {
  currentUser: { email: string; name: string; roleId?: string };
}

const TabValidaciones: React.FC<TabValidacionesProps> = ({ currentUser }) => {
  const [peticiones, setPeticiones] = useState<PeticionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PeticionAdmin | null>(null);
  const [draftResponse, setDraftResponse] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [aiNormativas, setAiNormativas] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPendingValidations();
    setPeticiones(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSelect = (p: PeticionAdmin) => {
    setSelected(p);
    setDraftResponse(p.respuesta_oficial || '');
    setAiNormativas([]);
  };

  const handleGenerateAI = async () => {
    if (!selected) return;
    setGeneratingAI(true);
    const textoCompleto = `${selected.asunto}\n\n${selected.descripcion || ''}`;
    const result = await generateOfficialResponse(textoCompleto, selected.categoria);
    if (result.success) {
      setDraftResponse(result.draft);
      setAiNormativas(result.normativasUsadas);
      showToast('Borrador generado por Grok con normativas de Supabase.', 'ok');
    } else {
      showToast(`Error al generar: ${result.error}`, 'err');
    }
    setGeneratingAI(false);
  };

  const handleApprove = async () => {
    if (!selected || !draftResponse.trim()) {
      showToast('Escribe o genera una respuesta antes de aprobar.', 'err');
      return;
    }
    setProcessing(true);
    const ok = await approveResponse(selected.id, draftResponse, currentUser.email);
    if (ok) {
      setPeticiones(prev => prev.filter(p => p.id !== selected.id));
      setSelected(null);
      setDraftResponse('');
      showToast('Respuesta aprobada y radicado marcado como "Resuelto".', 'ok');
    } else {
      showToast('Error al aprobar. Verifica permisos en Supabase.', 'err');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selected || !draftResponse.trim()) {
      showToast('Escribe el motivo del rechazo antes de rechazar.', 'err');
      return;
    }
    setProcessing(true);
    const ok = await rejectPeticion(selected.id, draftResponse, currentUser.email);
    if (ok) {
      setPeticiones(prev => prev.filter(p => p.id !== selected.id));
      setSelected(null);
      setDraftResponse('');
      showToast('Petición rechazada. El estado fue actualizado en Supabase.', 'ok');
    } else {
      showToast('Error al rechazar. Verifica permisos en Supabase.', 'err');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
        <p>Cargando peticiones pendientes...</p>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      <div className="admin-section-header">
        <div>
          <h2>Validación de Respuestas</h2>
          <p>{peticiones.length} petición(es) pendientes de revisión</p>
        </div>
        <button className="admin-btn-refresh" onClick={load}>↻ Actualizar</button>
      </div>

      <div className="admin-validaciones-layout">
        {/* Lista de peticiones */}
        <div className="admin-peticiones-list">
          {peticiones.length === 0 ? (
            <div className="admin-empty-state">
              <div style={{ fontSize: '2rem' }}>🎉</div>
              <p>No hay peticiones pendientes de validación.</p>
            </div>
          ) : (
            peticiones.map(p => (
              <div
                key={p.id}
                className={`admin-peticion-card ${selected?.id === p.id ? 'selected' : ''}`}
                onClick={() => handleSelect(p)}
              >
                <div className="admin-peticion-card-top">
                  <span className="admin-peticion-id">{p.id}</span>
                  <span className="admin-peticion-cat">{p.categoria}</span>
                </div>
                <p className="admin-peticion-asunto">{p.asunto}</p>
                <div className="admin-peticion-card-bottom">
                  <span>{p.solicitante}</span>
                  <span className={`admin-estado-badge estado-${p.estado.replace(' ', '-').toLowerCase()}`}>
                    {p.estado}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel de edición */}
        {selected ? (
          <div className="admin-validacion-editor">
            <div className="admin-editor-header">
              <h3>{selected.id}</h3>
              <button className="admin-btn-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="admin-peticion-detail">
              <div className="admin-detail-row">
                <strong>Solicitante:</strong> <span>{selected.solicitante} — {selected.email_solicitante}</span>
              </div>
              <div className="admin-detail-row">
                <strong>Categoría:</strong> <span>{selected.categoria}</span>
              </div>
              <div className="admin-detail-row">
                <strong>Tipo:</strong> <span>{selected.tipo_solicitud}</span>
              </div>
              <div className="admin-detail-row">
                <strong>Asunto:</strong> <span>{selected.asunto}</span>
              </div>
              {selected.descripcion && (
                <div className="admin-detail-row full">
                  <strong>Descripción:</strong>
                  <p>{selected.descripcion}</p>
                </div>
              )}
            </div>

            {/* AI Generate */}
            <div className="admin-ai-bar">
              <button
                className="admin-btn-ai"
                onClick={handleGenerateAI}
                disabled={generatingAI}
              >
                {generatingAI ? '⏳ Consultando normativas y generando...' : '🤖 Generar borrador con Grok + Normativas'}
              </button>
            </div>

            {aiNormativas.length > 0 && (
              <div className="admin-normativas-usadas">
                <strong>Normativas consultadas en Supabase:</strong>
                <ul>
                  {aiNormativas.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <div className="admin-field-group">
              <label>Respuesta Oficial (editable)</label>
              <textarea
                className="admin-textarea large"
                value={draftResponse}
                rows={10}
                placeholder="Escribe o genera la respuesta oficial aquí..."
                onChange={e => setDraftResponse(e.target.value)}
              />
            </div>

            <div className="admin-validation-actions">
              <button
                className="admin-btn-reject"
                onClick={handleReject}
                disabled={processing}
              >
                ✕ Rechazar
              </button>
              <button
                className="admin-btn-approve"
                onClick={handleApprove}
                disabled={processing}
              >
                ✓ Aprobar y Publicar
              </button>
            </div>

            <div className="admin-info-box">
              <strong>ℹ️ Flujo de validación:</strong> Al aprobar, la respuesta se publica en Supabase con estado "Resuelto"
              y queda registrada con tu nombre como validador. El ciudadano podrá consultar la respuesta oficial.
            </div>
          </div>
        ) : (
          <div className="admin-editor-placeholder">
            <div style={{ fontSize: '2rem' }}>👆</div>
            <p>Selecciona una petición de la lista para revisar y validar su respuesta.</p>
          </div>
        )}
      </div>
    </div>
  );
};
