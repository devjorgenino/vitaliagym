import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server-auth';
import {
  auditNextPaymentDates,
  fixAuditDiscrepancies,
  fixAllClientStatuses,
  recalculateAllNextPaymentDates,
} from '@/utils/paymentCalculations';

/**
 * Endpoint de mantenimiento para corregir estados y fechas de pagos.
 * Solo accesible por usuarios con permisos de administrador.
 *
 * Acciones disponibles:
 *   ?action=audit       → Auditoría sin cambios (solo lectura)
 *   ?action=fix-status  → Corrige solo el estado de clientes
 *   ?action=fix-dates   → Corrige solo las fechas de próximo pago
 *   ?action=fix-all     → Corre todo (estados + fechas)
 */
const ACTIONS = ['audit', 'fix-status', 'fix-dates', 'fix-all'];
const ADMIN_PERMISSION = 'admin.access';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Verificar permisos de administrador
  const authResult = await requirePermission(request, ADMIN_PERMISSION);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  // Validar acción
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      {
        error: `Acción no válida. Acciones disponibles: ${ACTIONS.join(', ')}`,
        availableActions: ACTIONS,
      },
      { status: 400 }
    );
  }

  try {
    switch (action) {
      case 'audit':
        return NextResponse.json(await auditNextPaymentDates());

      case 'fix-status':
        return NextResponse.json(await fixAllClientStatuses());

      case 'fix-dates': {
        const auditResult = await auditNextPaymentDates();
        let fixResult = null;
        if (auditResult.discrepancies.length > 0) {
          fixResult = await fixAuditDiscrepancies(auditResult.discrepancies);
        }
        return NextResponse.json({
          audit: auditResult,
          fix: fixResult,
          message: fixResult
            ? `Se corrigieron ${fixResult.updated} de ${fixResult.updated + fixResult.errors.length} clientes`
            : 'No hay discrepancias de fechas que corregir',
        });
      }

      case 'fix-all': {
        // 1. Auditar fechas
        const auditResult = await auditNextPaymentDates();

        // 2. Corregir fechas si hay discrepancias
        let dateFixResult = null;
        if (auditResult.discrepancies.length > 0) {
          dateFixResult = await fixAuditDiscrepancies(auditResult.discrepancies);
        }

        // 3. Corregir estados de clientes
        const statusResult = await fixAllClientStatuses();

        return NextResponse.json({
          audit: auditResult,
          dates: dateFixResult ?? { updated: 0, errors: [] },
          status: statusResult,
          message: `
            Fechas corregidas: ${dateFixResult?.updated ?? 0}
            Estados corregidos: ${statusResult.updated ?? 0}
          `.trim(),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Acción no implementada' },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('Error en mantenimiento:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
