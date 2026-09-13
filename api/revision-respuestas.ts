import express from 'express';
import { supabase } from '../src/lib/supabase';

const router = express.Router();

// Helper to check backend role permissions for approval
async function checkUserCanApprove(userId?: string): Promise<{ canApprove: boolean; roleName?: string }> {
  if (!userId) return { canApprove: false };

  try {
    const { data: userRow } = await supabase
      .from('usuarios')
      .select('role_id, roles(id, nombre, permisos)')
      .eq('id', userId)
      .single();

    if (!userRow) return { canApprove: false };

    const roleId = userRow.role_id;
    const permissions: string[] = (userRow.roles as any)?.permisos || [];

    const isAuthorizedRole = roleId === 'admin' || roleId === 'admin_municipal' || roleId === 'revisor';
    const hasPermission = permissions.includes('aprobar_radicados') || permissions.includes('admin_total');

    return {
      canApprove: isAuthorizedRole || hasPermission,
      roleName: (userRow.roles as any)?.nombre || roleId
    };
  } catch {
    return { canApprove: false };
  }
}

// POST /api/revision-respuestas/cambiar-estado -> Actualiza estado con trazabilidad y verificación de RLS/Rol
router.post('/cambiar-estado', async (req, res) => {
  try {
    const { radicadoId, estadoAnterior, estadoNuevo, userId, userNombre, observacion } = req.body;

    if (!radicadoId || !estadoNuevo) {
      res.status(400).json({ error: 'Parámetros obligatorios faltantes: radicadoId y estadoNuevo.' });
      return;
    }

    // Validación estricta de Backend: Solo Revisores y Admins pueden APROBAR o EMITIR
    if (estadoNuevo === 'APROBADO' || estadoNuevo === 'EMITIDO') {
      const { canApprove } = await checkUserCanApprove(userId);
      if (!canApprove) {
        res.status(403).json({
          error: 'Permisos insuficientes. Tu rol o perfil actual de usuario no cuenta con autorización para validar o aprobar respuestas oficiales.'
        });
        return;
      }
    }

    // 1. Registrar entrada en historial de estados
    await supabase.from('historial_estados_radicado').insert({
      radicado_id: radicadoId,
      estado_anterior: estadoAnterior || 'RECIBIDO',
      estado_nuevo: estadoNuevo,
      usuario_id: userId || null,
      usuario_nombre: userNombre || 'Usuario Sistema',
      observacion: observacion || 'Actualización de estado en flujo de revisión',
      fecha: new Date().toISOString()
    });

    // 2. Actualizar estado en peticiones_pqrs si la tabla existe
    await supabase
      .from('peticiones_pqrs')
      .update({
        estado: estadoNuevo,
        respuesta_oficial: observacion || undefined
      })
      .eq('id', radicadoId);

    // 3. Registrar auditoría general del sistema
    await supabase.from('auditoria').insert({
      usuario_id: userId || 'Sistema',
      usuario_nombre: userNombre || 'Usuario',
      accion: `CAMBIO_ESTADO_${estadoNuevo}`,
      elemento_modificado: `Radicado: ${radicadoId}`,
      valor_anterior: estadoAnterior || 'N/A',
      valor_nuevo: estadoNuevo,
      created_at: new Date().toISOString()
    });

    res.status(200).json({
      radicado_id: radicadoId,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      usuario_id: userId,
      usuario_nombre: userNombre,
      fecha: new Date().toISOString(),
      observacion: observacion
    });
  } catch (err: any) {
    console.error('Error al cambiar estado de radicado:', err);
    res.status(500).json({ error: err?.message || 'Error interno al actualizar estado del radicado.' });
  }
});

// POST /api/revision-respuestas/guardar-version -> Guarda/crea versión numerada (Inmutabilidad para EMITIDO)
router.post('/guardar-version', async (req, res) => {
  try {
    const { radicadoId, respuestaTexto, userId, userNombre, observaciones, estadoActual } = req.body;

    if (!radicadoId || !respuestaTexto) {
      res.status(400).json({ error: 'Faltan campos requeridos: radicadoId y respuestaTexto.' });
      return;
    }

    // Consultar última versión existente para este radicado
    const { data: versionesPrevias } = await supabase
      .from('versiones_respuestas')
      .select('version_numero')
      .eq('radicado_id', radicadoId)
      .order('version_numero', { ascending: false })
      .limit(1);

    const nextVersionNum = versionesPrevias && versionesPrevias.length > 0
      ? versionesPrevias[0].version_numero + 1
      : 1;

    // Crear la nueva versión inmutable
    const { data: newVer, error } = await supabase
      .from('versiones_respuestas')
      .insert({
        radicado_id: radicadoId,
        version_numero: nextVersionNum,
        respuesta_texto: respuestaTexto,
        modificado_por_id: userId || null,
        modificado_por_nombre: userNombre || 'Revisor',
        observaciones: observaciones || (estadoActual === 'EMITIDO' ? 'Nueva versión generada post-emisión' : 'Edición de borrador'),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      mensaje: `Versión v${nextVersionNum} guardada correctamente.`,
      version: newVer
    });
  } catch (err: any) {
    console.error('Error al guardar versión de respuesta:', err);
    res.status(500).json({ error: err?.message || 'Error al registrar nueva versión de respuesta.' });
  }
});

// GET /api/revision-respuestas/historial/:radicadoId -> Obtener historial completo de un radicado
router.get('/historial/:radicadoId', async (req, res) => {
  try {
    const { radicadoId } = req.params;

    const [versionesRes, estadosRes] = await Promise.all([
      supabase.from('versiones_respuestas').select('*').eq('radicado_id', radicadoId).order('version_numero', { ascending: false }),
      supabase.from('historial_estados_radicado').select('*').eq('radicado_id', radicadoId).order('fecha', { ascending: false })
    ]);

    res.status(200).json({
      radicado_id: radicadoId,
      versiones: versionesRes.data || [],
      historial_estados: estadosRes.data || []
    });
  } catch (err: any) {
    console.error('Error al consultar historial del radicado:', err);
    res.status(500).json({ error: 'Error al consultar historial de versiones y estados.' });
  }
});

export default router;
