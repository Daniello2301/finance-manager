# Specification: Dashboard y Reportes

## Overview
El dashboard es la pantalla principal tras iniciar sesión: da al usuario una vista consolidada de su situación financiera (balance total, tendencia de ingresos/gastos, distribución de gasto por categoría) usando Recharts. No introduce datos nuevos — es una capa de agregación de lectura sobre Cuentas, Transacciones y Presupuestos ya existentes.

---

## User Stories (Priority Order)

### P1 - Critical (MVP)

**[US1]** Como usuario, quiero ver mi balance total (suma de saldos de todas mis cuentas activas) al entrar al dashboard, para saber mi situación financiera de un vistazo
- Aceptación: Suma de `currentBalance` de cuentas no archivadas, agrupado por moneda si hay más de una

**[US2]** Como usuario, quiero ver un gráfico de tendencia de ingresos vs. gastos de los últimos meses, para entender mi patrón de ahorro
- Aceptación: Gráfico de líneas/barras (Recharts) con los últimos 6 meses por defecto, ingresos y gastos totales por mes

**[US3]** Como usuario, quiero ver la distribución de mis gastos del mes actual por categoría, para saber en qué se me va el dinero
- Aceptación: Gráfico de dona/barras con el top de categorías por gasto en el mes seleccionado

**[US4]** Como usuario, quiero ver un resumen rápido de mis presupuestos del mes actual desde el dashboard, para no tener que entrar a la sección de Presupuestos a revisar
- Aceptación: Widget con las 3-5 categorías con mayor % de presupuesto consumido, enlaza a la vista completa de Presupuestos

### P2 - Important

**[US5]** Como usuario, quiero cambiar el rango de meses del gráfico de tendencia (3, 6, 12 meses), para ajustar el nivel de detalle
- Aceptación: Selector de rango, refetch vía React Query

**[US6]** Como usuario, quiero ver mis últimas transacciones directamente en el dashboard, para revisar actividad reciente sin navegar
- Aceptación: Lista de las últimas 5-10 transacciones, enlaza al listado completo

### P3 - Nice to Have

**[US7]** Como usuario, quiero personalizar qué widgets se muestran en mi dashboard
- Aceptación: Fuera de alcance MVP

---

## Acceptance Scenarios

### Scenario 1: Balance total con una sola moneda
```
Given tengo 3 cuentas activas en COP con saldos 500000, -200000 (tarjeta) y 1000000
When entro al dashboard
Then veo "Balance total: $1.300.000 COP"
```

### Scenario 2: Tendencia de ingresos vs. gastos
```
Given tengo transacciones registradas en los últimos 6 meses
When entro al dashboard
Then veo un gráfico con una barra/línea de ingresos y otra de gastos por cada uno de los últimos 6 meses
```

### Scenario 3: Distribución de gasto por categoría del mes actual
```
Given en julio 2026 gasté 300000 en "Alimentación / Mercado", 200000 en "Transporte" y 100000 en "Entretenimiento"
When veo el gráfico de distribución de julio
Then veo tres segmentos proporcionales: 50%, 33.3%, 16.7%
```

### Scenario 4: Usuario sin transacciones (estado vacío)
```
Given un usuario recién registrado sin transacciones
When entra al dashboard
Then ve un estado vacío con balance = suma de saldos iniciales de sus cuentas (si las creó)
  And un mensaje invitando a registrar su primera transacción, en vez de gráficos vacíos o errores
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Endpoint agregado de balance total por moneda, sumando `currentBalance` de cuentas activas | P1 | Si hay >1 moneda, mostrar un total por cada una (sin conversión en Fase 1) |
| FR-002 | Endpoint de tendencia mensual: total ingresos y total gastos agrupados por mes, rango configurable (default 6 meses) | P1 | Agregación sobre `Transaction` con `$group` por año-mes |
| FR-003 | Endpoint de distribución de gasto por categoría de un mes dado | P1 | Agregación sobre `Transaction` filtrando `type='expense'` |
| FR-004 | Endpoint de resumen de presupuestos del mes actual (top categorías por % consumido) | P1 | Reutiliza `getBudgetProgress` de la spec de Presupuestos |
| FR-005 | Endpoint de últimas N transacciones | P2 | Reutiliza el listado de Transacciones con `limit` pequeño y sin filtros |
| FR-006 | Todos los agregados filtran por `userId` | P1 | Ninguna query de dashboard cruza tenants |
| FR-007 | Manejar estado vacío (usuario sin cuentas/transacciones) sin errores en los gráficos | P1 | Ver Escenario 4 |

---

## Technical Context

### Database
No introduce modelos nuevos. Consulta `Account`, `Transaction`, `Budget`, `Category` vía agregaciones de solo lectura.

### API Endpoints

- `GET /api/dashboard/summary` — balance total por moneda + resumen de presupuestos del mes actual
- `GET /api/dashboard/trend?months=6` — ingresos/gastos totales por mes
- `GET /api/dashboard/category-breakdown?period=2026-07` — distribución de gasto por categoría
- `GET /api/dashboard/recent-transactions?limit=10` — últimas transacciones

Todos devuelven datos ya agregados y listos para pasar directo a componentes de Recharts (sin lógica de agregación en el cliente).

### Frontend Components

- `DashboardPage.tsx` (`src/app/dashboard/page.tsx`) — layout de widgets
- `BalanceSummaryCard.tsx` — balance total por moneda
- `TrendChart.tsx` — gráfico de líneas/barras (Recharts), con selector de rango (US5)
- `CategoryBreakdownChart.tsx` — gráfico de dona/barras (Recharts)
- `BudgetSummaryWidget.tsx` — mini-resumen de presupuestos, enlaza a `/budgets`
- `RecentTransactionsWidget.tsx` — últimas transacciones, enlaza a `/transactions`
- `EmptyDashboardState.tsx` — estado vacío para usuarios nuevos

### Authentication
Requiere sesión (`requireSession()`). Es la página protegida por defecto tras login (`ProtectedRoute`, ya definido en la spec de Autenticación).

---

## Success Criteria

- [ ] Balance total correcto y agrupado por moneda (P1)
- [ ] Gráfico de tendencia refleja correctamente ingresos/gastos por mes (P1)
- [ ] Gráfico de distribución por categoría refleja correctamente el gasto del mes (P1)
- [ ] Resumen de presupuestos coincide con los datos de la sección de Presupuestos (P1)
- [ ] Estado vacío manejado sin errores para usuarios nuevos (P1)
- [ ] Tests unitarios/integración: >80% cobertura de los endpoints de agregación
- [ ] Aislamiento multi-tenant verificado en cada agregación

---

## Out of Scope
- Exportar reportes a PDF/Excel
- Widgets personalizables por el usuario (P3)
- Comparación año contra año
- Conversión de balance a una sola moneda cuando hay multi-moneda (llega con la spec de Multi-moneda en Fase 2)

## Dependencies
- **Interno**: Modelos `Account`, `Transaction`, `Category`, `Budget` (specs previas de Fase 1), servicio `getBudgetProgress` de `budgets.md`
- **Externo**: Recharts (ya instalado)

## Estimated Effort
- Días: 3-4
- Complejidad: Media (agregaciones MongoDB por mes/categoría; sin lógica de negocio nueva más allá de lectura)

## Notes
1. El dashboard es puramente de lectura — no crea/edita ningún documento, por lo que no necesita transacciones multi-documento ni se preocupa por consistencia de escritura.
2. Se implementa **al final** de Fase 1 porque depende de que Cuentas, Categorías, Transacciones y Presupuestos ya existan y tengan datos que agregar.
