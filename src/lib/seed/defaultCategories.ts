import type { Types } from "mongoose";
import Category from "@/lib/models/Category";

export const DEFAULT_CATEGORIES = {
  income: [
    "Salario",
    "Freelance / Independiente",
    "Inversiones",
    "Otros ingresos",
  ],
  expense: [
    "Vivienda",
    "Alimentación / Mercado",
    "Restaurantes y comida a domicilio",
    "Transporte",
    "Salud",
    "Educación",
    "Entretenimiento",
    "Ropa y accesorios",
    "Suscripciones",
    "Seguros",
    "Mascotas",
    "Cuidado personal",
    "Regalos y donaciones",
    "Impuestos",
    "Deudas y préstamos",
    "Ahorro e inversión",
    "Otros gastos",
  ],
} as const;

export async function seedDefaultCategories(
  userId: string | Types.ObjectId
): Promise<void> {
  const docs = [
    ...DEFAULT_CATEGORIES.income.map((name) => ({
      userId,
      name,
      type: "income" as const,
      isDefault: true,
    })),
    ...DEFAULT_CATEGORIES.expense.map((name) => ({
      userId,
      name,
      type: "expense" as const,
      isDefault: true,
    })),
  ];

  await Category.insertMany(docs);
}
