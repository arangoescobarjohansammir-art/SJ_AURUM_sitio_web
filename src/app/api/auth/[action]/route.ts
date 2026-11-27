import { cookies } from "next/headers";
import { assertOrigin, jsonBody, response, failure, limit } from "@/lib/http";
import {
  authToken,
  setAuthCookie,
  authCookie,
  currentAuth,
} from "@/lib/auth-http";
import {
  register,
  login,
  logout,
  consumeToken,
  requireDevelopmentAccounts,
} from "@/modules/auth/service";
import { deliverLocalToken } from "@/modules/auth/mail";
import { tokenHash } from "@/modules/auth/password";
import { emailSchema } from "@/modules/auth/validation";
import { CommerceError } from "@/modules/commerce/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    assertOrigin(request);
    requireDevelopmentAccounts();
    const { action } = await params;
    if (
      ![
        "register",
        "login",
        "logout",
        "request-reset",
        "request-verification",
        "verify",
        "reset",
      ].includes(action)
    )
      throw new CommerceError("NOT_FOUND", "Acción no encontrada.", 404);
    await limit("auth-global", 60);
    const body = await jsonBody(request);
    if (body === null || typeof body !== "object" || Array.isArray(body))
      throw new CommerceError("VALIDATION", "Revisa los datos.", 400);
    if (
      ["register", "login", "request-reset", "request-verification"].includes(
        action,
      )
    ) {
      const email = emailSchema.parse(body.email);
      await limit("auth-email:" + tokenHash(email), 10);
    }
    if (action === "register") {
      const user = await register(body);
      if (user) await deliverLocalToken(user.email, "VERIFY");
      return response(
        {
          message:
            "Si el correo permite crear una cuenta, se preparó su verificación en la bandeja local. No se envió correo real. Puedes iniciar sesión con tus datos.",
        },
        202,
      );
    }
    if (action === "login") {
      if (await currentAuth())
        throw new CommerceError(
          "ALREADY_SIGNED_IN",
          "Cierra tu sesión antes de entrar en otra cuenta.",
          409,
        );
      const result = await login(
        body,
        (await cookies()).get("aurum_visitor")?.value,
      );
      await setAuthCookie(result.token);
      (await cookies()).delete("aurum_visitor");
      return response({ ok: true, adjusted: result.adjusted });
    }
    if (action === "logout") {
      await logout(await authToken());
      const jar = await cookies();
      jar.delete(authCookie);
      jar.delete("aurum_visitor");
      return response({ ok: true });
    }
    if (action === "request-reset" || action === "request-verification") {
      await deliverLocalToken(
        body.email,
        action === "request-reset" ? "RESET" : "VERIFY",
      );
      return response(
        {
          message:
            "Si la cuenta corresponde, el enlace está en la bandeja local de desarrollo. No se ha enviado un correo real.",
        },
        202,
      );
    }
    const result = await consumeToken(
      body,
      action === "verify" ? "VERIFY" : "RESET",
    );
    if (action === "reset") (await cookies()).delete(authCookie);
    return response(result);
  } catch (error) {
    return failure(error);
  }
}
