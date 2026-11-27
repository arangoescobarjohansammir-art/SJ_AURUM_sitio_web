import { z } from "zod";
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .min(15, "Usa al menos 15 caracteres.")
  .max(128, "Máximo 128 caracteres.");
export const registerSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: emailSchema,
  password: passwordSchema,
  acceptedDemo: z.literal(true),
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const resetSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});
export const profileSchema = z.object({
  name: z.string().trim().min(3).max(100),
});
export const addressSchema = z.object({
  label: z.string().trim().min(2).max(50),
  recipient: z.string().trim().min(3).max(100),
  phone: z.string().regex(/^(?:\+57)?3\d{9}$/),
  department: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  street: z.string().trim().min(8).max(200),
  additional: z.string().trim().max(300).default(""),
});
