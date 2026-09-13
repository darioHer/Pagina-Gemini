import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import type { User, Role, UserStatus } from '../types/radicacion';
import { 
  fetchUsersList, 
  updateUserRole, 
  updateUserStatus, 
  fetchRolesList, 
  createNewRole 
} from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';

export const AdminUsuariosPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<UserStatus | 'todos'>('todos');

  // Role management modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [newRoleId, setNewRoleId] = useState<string>('');
  const [newRoleNombre, setNewRoleNombre] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');
  const [selectedPermisos, setSelectedPermisos] = useState<string[]>(['radicar_pqr', 'ver_mis_radicados']);

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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedUsers, fetchedRoles] = await Promise.all([
        fetchUsersList({
          searchQuery: searchQuery,
          roleId: selectedRoleFilter,
          estado: selectedStatusFilter
        }),
        fetchRolesList()
      ]);
      setUsers(fetchedUsers);
      setRoles(fetchedRoles);
    } catch (e: any) {
      setError('Error al cargar la lista de usuarios y roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRoleFilter, selectedStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    setError(null);
    setSuccess(null);
    const ok = await updateUserRole(userId, newRoleId);
    if (ok) {
      setSuccess('Rol de usuario actualizado correctamente.');
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const roleObj = roles.find((r) => r.id === newRoleId);
            return { ...u, roleId: newRoleId, roleName: roleObj?.nombre || newRoleId };
          }
          return u;
        })
      );
    } else {
      setError('No se pudo actualizar el rol. Verifica los permisos de Supabase RLS.');
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: UserStatus) => {
    setError(null);
    setSuccess(null);
    const nextStatus: UserStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    const ok = await updateUserStatus(userId, nextStatus);
    if (ok) {
      setSuccess(`Usuario ${nextStatus === 'activo' ? 'activado' : 'desactivado'} exitosamente.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, estado: nextStatus } : u))
      );
    } else {
      setError('No se pudo modificar el estado del usuario.');
    }
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleNombre.trim() || !newRoleDesc.trim()) {
      setError('Nombre y descripción del rol son obligatorios.');
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
      setSuccess(`Rol "${newRoleNombre}" creado exitosamente.`);
      setIsRoleModalOpen(false);
      setNewRoleId('');
      setNewRoleNombre('');
      setNewRoleDesc('');
      loadData();
    } else {
      setError('Error al crear el rol en Supabase.');
    }
  };

  const getRoleBadgeColor = (roleId: string) => {
    switch (roleId) {
      case 'admin':
      case 'admin_municipal':
        return '#dc2626'; // Red
      case 'gobernanza':
        return '#7c3aed'; // Purple
      case 'revisor':
      case 'analista_pqrs':
        return '#2563eb'; // Blue
      default:
        return '#16a34a'; // Green
    }
  };

  const isAdmin = currentUser?.roleId === 'admin' || currentUser?.roleId === 'admin_municipal' || currentUser?.permissions?.includes('gestionar_usuarios');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header institucional */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <ShieldCheck size={16} />
            <span>Módulo de Seguridad • Fase 1</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Administración de Usuarios, Roles y Permisos
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Gestión centralizada de cuentas, control de estado y asignación de roles guardados en Supabase.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <RefreshCw size={16} />
            <span>Refrescar</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <Plus size={16} />
              <span>Crear Nuevo Rol</span>
            </button>
          )}
        </div>
      </div>


      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Bar de Filtros y Búsqueda */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              Buscar por Nombre o Correo
            </label>
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
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              Filtrar por Rol
            </label>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
            >
              <option value="todos">Todos los Roles ({roles.length})</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              Filtrar por Estado
            </label>
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
            <button
              type="submit"
              style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Filter size={16} />
              <span>Aplicar Filtros</span>
            </button>
          </div>

        </form>
      </div>

      {/* Tabla de Usuarios */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spinner-icon" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem auto' }} />
            <p>Cargando lista de usuarios y roles desde Supabase...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Users size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem auto' }} />
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>No se encontraron usuarios.</p>
            <p style={{ fontSize: '0.85rem' }}>Prueba ajustando los términos de búsqueda o filtros.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Usuario / Titular</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Correo Electrónico</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Rol Asignado</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Fecha de Registro</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                    
                    {/* Usuario / Avatar */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img
                          src={u.avatar}
                          alt={u.name}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            ID: {u.id.length > 18 ? u.id.slice(0, 18) + '...' : u.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 500 }}>
                      {u.email}
                    </td>

                    {/* Selector de Rol */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <select
                        value={u.roleId}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: '#f8fafc',
                          color: getRoleBadgeColor(u.roleId),
                          cursor: 'pointer'
                        }}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Estado Badge */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: u.estado === 'activo' ? '#dcfce7' : '#fee2e2',
                          color: u.estado === 'activo' ? '#15803d' : '#b91c1c'
                        }}
                      >
                        {u.estado === 'activo' ? <UserCheck size={13} /> : <UserX size={13} />}
                        <span>{u.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
                      </span>
                    </td>

                    {/* Fecha de Registro */}
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO') : 'Reciente'}
                    </td>

                    {/* Botón de Cambiar Estado */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(u.id, u.estado)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: u.estado === 'activo' ? '#fef2f2' : '#f0fdf4',
                          color: u.estado === 'activo' ? '#dc2626' : '#16a34a'
                        }}
                      >
                        {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

export default AdminUsuariosPage;
