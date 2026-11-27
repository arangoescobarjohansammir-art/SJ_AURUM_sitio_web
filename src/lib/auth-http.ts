import "server-only";
import { cookies } from "next/headers";
import { authenticate, requireCustomer } from "@/modules/auth/service";
export const authCookie = "aurum_account";
export async function authToken() {
  return (await cookies()).get(authCookie)?.value;
}
export async function currentAuth() {
  return authenticate(await authToken());
}
export async function account() {
  return requireCustomer(await authToken());
}
export async function setAuthCookie(token: string) {
  (await cookies()).set(authCookie, token, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://") ?? true,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400,
  });
}
