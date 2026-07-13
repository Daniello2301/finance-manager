# Implementation Plan: Dashboard y Reportes

**Specification**: `.speckit/specs/dashboard.md`
**User Stories Covered**: US1-US7 (US7 fuera de alcance MVP)
**Tech Stack**: Next.js 16, Mongoose (agregaciones), Recharts, React Query

---

## Phase 0: Research & Validation

### Constitution Check
- ✅ Módulo puramente de lectura — sin escrituras, sin necesidad de sesiones/transacciones Mongo
- ✅ Aislamiento multi-tenant: cada agregación filtra por `userId`
- ✅ Reutiliza servicios existentes (`getBudgetProgress`) en vez de duplicar lógica

### Technical Research
| Question | Answer | Confidence |
|----------|--------|-----------|
| ¿Cómo se agrupa la tendencia mensual (ingresos/gastos por mes)? | `Transaction.aggregate` con `$group` sobre `{ $dateToString: { format: '%Y-%m', date: '$date' } }`, separado por `type` | High |
| ¿Qué pasa si el usuario tiene cuentas en varias monedas (antes de que exista conversión real en Fase 2)? | El balance total se agrupa y muestra por moneda por separado (`{ COP: 1300000 }`), sin sumar monedas distintas | High |
| ¿Se cachea algo en el servidor? | No en Fase 1 — los agregados son baratos a la escala de una app personal; se apoya en el `staleTime` de React Query en el cliente en vez de cache de servidor (evita complejidad prematura, Principio 4) | High |

### Project Structure Review
- **Depende de**: Cuentas, Categorías, Transacciones y Presupuestos ya implementados con datos reales que agregar — es el **último** módulo de Fase 1
- **Reutiliza**: `getBudgetProgress` de `src/lib/services/budgets.ts`, `MonthSelector.tsx` de Presupuestos

---

## Phase 1: Design & Architecture

### Servicios de Agregación

`src/lib/services/dashboard.ts`
```typescript
export async function getBalanceSummary(userId: string) {
  const accounts = await Account.findForUser(userId, { isArchived: false })
  return groupBy(accounts, 'currency').map(([currency, accs]) => ({
    currency,
    total: accs.reduce((sum, a) => sum + a.currentBalance, 0)
  }))
}

export async function getMonthlyTrend(userId: string, months = 6) {
  const since = startOfMonthsAgo(months)
  return Transaction.aggregate([
    { $match: { userId, date: { $gte: since } } },
    { $group: {
        _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' },
        total: { $sum: '$amount' }
    }},
    { $sort: { '_id.month': 1 } }
  ])
  // post-procesado: pivotea a [{ month, income, expense }]
}

export async function getCategoryBreakdown(userId: string, periodKey: string) {
  const { periodStart, periodEnd } = periodRange(periodKey)
  return Transaction.aggregate([
    { $match: { userId, type: 'expense', date: { $gte: periodStart, $lt: periodEnd } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    { $sort: { total: -1 } }
  ])
}
```

`getBudgetProgress(userId, currentPeriodKey)` se reutiliza tal cual de `src/lib/services/budgets.ts`, tomando el top N por `percentUsed`.

### API Routes Structure

```
src/app/api/dashboard/
├── summary/route.ts               # GET — balance total + top presupuestos
├── trend/route.ts                 # GET ?months=6
├── category-breakdown/route.ts    # GET ?period=YYYY-MM
├── recent-transactions/route.ts   # GET ?limit=10
└── __tests__/
```

Todos son `GET`, sin body, solo query params validados con Zod. Ninguno escribe datos.

### Component Hierarchy

```
src/app/dashboard/
├── page.tsx
└── components/
    ├── BalanceSummaryCard.tsx
    ├── TrendChart.tsx              # Recharts LineChart/BarChart
    ├── CategoryBreakdownChart.tsx  # Recharts PieChart
    ├── BudgetSummaryWidget.tsx
    ├── RecentTransactionsWidget.tsx
    └── EmptyDashboardState.tsx
```

### State Management
- **React Query**: un hook por widget (`useBalanceSummary`, `useMonthlyTrend`, `useCategoryBreakdown`, `useBudgetSummary`, `useRecentTransactions`), cada uno con su propio `staleTime` (p. ej. 60s) — los widgets cargan independientemente, no bloquean unos a otros
- **Zustand**: solo el rango de meses seleccionado en `TrendChart` (US5)

---

## Phase 2: Implementation

### Complexity Assessment

| Aspect | Complexity | Justification |
|--------|-----------|----------------|
| Agregaciones Mongo | Media | `$group` + `$lookup` estándar, sin recursividad ni joins complejos |
| API | Baja | Solo lectura, sin validación de escritura |
| Frontend | Media | Cuatro tipos de gráfico Recharts distintos + estado vacío |
| Testing | Media | Verificar que los números agregados coinciden con fixtures conocidos |

### Implementation Order (Test-First)

1. **`getBalanceSummary`** (0.5d): test con cuentas en una y varias monedas
2. **`getMonthlyTrend`** (1d): test con transacciones en varios meses, incluyendo meses sin datos (deben aparecer en 0, no omitirse)
3. **`getCategoryBreakdown`** (1d): test de distribución y orden descendente
4. **Endpoint de últimas transacciones** (0.5d): reutiliza query de listado de Transacciones con `limit`
5. **API routes** (1d): wiring + tests de integración
6. **Frontend — BalanceSummaryCard + EmptyDashboardState** (1d)
7. **Frontend — TrendChart** (1d)
8. **Frontend — CategoryBreakdownChart** (1d)
9. **Frontend — BudgetSummaryWidget + RecentTransactionsWidget** (1d)
10. **Integración de página completa + estado vacío para usuario nuevo** (0.5d)

### Critical Dependencies
- Todos los módulos anteriores de Fase 1 implementados y con datos reales de prueba

---

## Phase 3: Testing & Validation

**Unit**: cada función de `dashboard.ts` con fixtures de transacciones/cuentas conocidas, verificando el número exacto agregado
**Integration**: endpoints devuelven `200` con estructura esperada; usuario sin datos recibe estructuras vacías (`[]`/`0`), no error 500
**E2E manual**: usuario con datos de varios meses ve tendencia correcta; usuario nuevo ve `EmptyDashboardState` en vez de gráficos rotos

### Acceptance Criteria Check
- [ ] US1-US4 (P1) completas
- [ ] Escenario 4 de la spec (estado vacío) verificado explícitamente
- [ ] Cobertura >80%

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Meses sin transacciones se omiten del gráfico de tendencia en vez de mostrarse en 0 | Media | Medio | Post-procesar el resultado de la agregación rellenando los meses faltantes en el rango antes de devolver la respuesta |
| Gráficos rompen visualmente con un usuario sin datos | Media | Medio | `EmptyDashboardState` explícito, cubierto por test de integración (Escenario 4) |

---

## Timeline & Resources
- **Duración estimada**: 6-7 días
- **Orden**: último módulo de Fase 1 — depende de que todos los demás ya tengan datos que agregar

---

## Notes & Decisions
1. No se introduce cache de servidor (Redis, etc.) en Fase 1 — se evalúa solo si el profiling en producción muestra que las agregaciones son un cuello de botella real (Principio 4, constitución).
2. `getBudgetProgress` se reutiliza sin modificar su firma — el Dashboard es un consumidor más, no un caso especial.
