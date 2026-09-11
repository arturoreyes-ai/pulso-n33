import { handlers } from "@/auth";

// El proveedor se llama `microsoft-entra-id`, asi que la URI de redireccion
// que se registra en Azure es {APP_URL}/api/auth/callback/microsoft-entra-id,
// exacta. Es el fallo de configuracion mas comun (redirect_uri_mismatch).
export const { GET, POST } = handlers;
