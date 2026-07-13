# Specification: Categorías

## Overview
Las categorías clasifican cada transacción como ingreso o gasto (p. ej. "Alimentación", "Salario"). Cada usuario nuevo recibe un set de categorías por defecto en español para poder empezar a registrar movimientos sin configuración previa, y puede personalizarlas libremente. Las categorías son la base de los Presupuestos y de los reportes del Dashboard.

---

## User Stories (Priority Order)

### P1 - Critical (MVP)

**[US1]** Como usuario nuevo, quiero tener categorías predefinidas al crear mi cuenta, para poder registrar mi primera transacción sin tener que configurar nada antes
- Prerequisitos: Ninguno — se siembran automáticamente en el signup
- Aceptación: Al completar el signup, el usuario tiene ~4 categorías de ingreso y ~16 de gasto, marcadas `isDefault: true`

**[US2]** Como usuario, quiero ver mis categorías separadas por ingreso/gasto, para elegir la correcta al registrar una transacción
- Aceptación: Listado filtrable por `type`, excluye archivadas por defecto

**[US3]** Como usuario, quiero crear una categoría personalizada, para clasificar gastos que no encajan en las categorías por defecto
- Aceptación: Categoría creada con `isDefault: false`, disponible inmediatamente en selectores

**[US4]** Como usuario, quiero renombrar o archivar una categoría (incluida una por defecto), para adaptar el set a mis necesidades
- Aceptación: Cambios persisten; archivar no borra el historial de transacciones que ya la usan

### P2 - Important

**[US5]** Como usuario, quiero asignar un color/ícono a cada categoría, para identificarlas visualmente en el dashboard y los listados
- Aceptación: Campos `color`/`icon` opcionales, usados en gráficos de Recharts

### P3 - Nice to Have

**[US6]** Como usuario, quiero crear subcategorías (p. ej. "Alimentación > Restaurantes"), para un desglose más fino
- Aceptación: Fuera de alcance MVP — requiere campo `parentCategoryId`, evaluar en Fase 2

---

## Acceptance Scenarios

### Scenario 1: Seed de categorías al signup
```
Given un usuario completa el signup exitosamente
When su cuenta se crea
Then automáticamente se crean sus categorías por defecto (Salario, Freelance / Independiente, Inversiones, Otros ingresos; Vivienda, Alimentación / Mercado, Restaurantes y comida a domicilio, Transporte, Salud, Educación, Entretenimiento, Ropa y accesorios, Suscripciones, Seguros, Mascotas, Cuidado personal, Regalos y donaciones, Impuestos, Deudas y préstamos, Ahorro e inversión, Otros gastos)
  And todas quedan marcadas isDefault: true
```

### Scenario 2: Nombre duplicado
```
Given ya tengo una categoría de gasto llamada "Transporte"
When intento crear otra categoría de gasto llamada "Transporte"
Then la operación es rechazada con error de duplicado
  And no se crea una categoría nueva
```

### Scenario 3: Archivar categoría con transacciones históricas
```
Given tengo una categoría "Entretenimiento" con 5 transacciones
When la archivo
Then desaparece de los selectores para nuevas transacciones
  And las 5 transacciones existentes siguen mostrando "Entretenimiento" en el historial y reportes
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Sembrar categorías por defecto en la misma request del signup | P1 | Insert síncrono, no job en background — evita dashboard vacío en primer login |
| FR-002 | Listar categorías del usuario filtrando por `type` y `isArchived` | P1 | |
| FR-003 | Crear categoría con `name, type, color?, icon?` | P1 | |
| FR-004 | Nombre único por `userId + type` | P1 | Índice único compuesto; error 409 en duplicado |
| FR-005 | Editar `name, color, icon` de cualquier categoría propia (incluidas `isDefault`) | P1 | El usuario puede renombrar/recolorear categorías sembradas |
| FR-006 | Archivar/desarchivar categoría (`isArchived`), nunca borrado duro | P1 | `Transaction` referencia `categoryId` |
| FR-007 | Todas las queries filtran por `userId` | P1 | Vía `Category.findForUser()` |

---

## Technical Context

### Database (MongoDB + Mongoose)

**Category Model** (`src/lib/models/Category.ts`)
```typescript
interface ICategory extends Document {
  userId: ObjectId
  name: string
  type: 'income' | 'expense'
  icon?: string
  color?: string
  isDefault: boolean          // sembrada vs. creada por el usuario
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

categorySchema.index({ userId: 1, type: 1, isArchived: 1 })
categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true })
```

**Seed list** (`src/lib/seed/defaultCategories.ts`)
```typescript
export const DEFAULT_CATEGORIES = {
  income: ['Salario', 'Freelance / Independiente', 'Inversiones', 'Otros ingresos'],
  expense: [
    'Vivienda', 'Alimentación / Mercado', 'Restaurantes y comida a domicilio',
    'Transporte', 'Salud', 'Educación', 'Entretenimiento', 'Ropa y accesorios',
    'Suscripciones', 'Seguros', 'Mascotas', 'Cuidado personal',
    'Regalos y donaciones', 'Impuestos', 'Deudas y préstamos', 'Ahorro e inversión',
    'Otros gastos'
  ]
}
```

### API Endpoints

- `GET /api/categories` — lista categorías del usuario (`?type=income|expense&includeArchived=true`)
- `POST /api/categories` — crea categoría personalizada
- `PATCH /api/categories/[id]` — edita categoría
- `DELETE /api/categories/[id]` — en realidad archiva

### Frontend Components

- `CategoryList.tsx` — lista con filtro por tipo
- `CategoryForm.tsx` — crear/editar, react-hook-form + Zod
- `CategorySelect.tsx` — selector reutilizable, agrupado por tipo, usado en Transacciones y Presupuestos

### Authentication
Requiere sesión (`requireSession()`). El seed de categorías se ejecuta desde el propio handler de signup (dependencia con la spec de Autenticación), no desde un endpoint separado.

---

## Success Criteria

- [ ] Todo usuario nuevo tiene sus categorías por defecto inmediatamente tras el signup (P1)
- [ ] Usuario puede crear, editar, archivar categorías propias (P1)
- [ ] No se permiten nombres duplicados por tipo (P1)
- [ ] Archivar una categoría no afecta transacciones históricas (P1)
- [ ] Tests unitarios: >80% cobertura
- [ ] Aislamiento multi-tenant verificado

---

## Out of Scope
- Subcategorías / jerarquías (P3, evaluar en Fase 2)
- Categorías compartidas o sugeridas por la comunidad
- Reordenamiento manual de categorías

## Dependencies
- **Interno**: Depende del flujo de signup (spec `authentication.md`) para disparar el seed. `src/lib/api-auth.ts`.
- **Externo**: Ninguna nueva

## Estimated Effort
- Días: 2
- Complejidad: Baja

## Notes
1. Se decidió sembrar categorías **por usuario** (copias reales, no una tabla global compartida) para mantener todas las queries como `{userId}` simple y permitir edición/archivado libre sin lógica especial para "categorías del sistema". Ver constitución Principio 8.
2. El seed ocurre en la misma transacción/request que crea el `User`, para que el primer login del usuario ya tenga categorías disponibles.
