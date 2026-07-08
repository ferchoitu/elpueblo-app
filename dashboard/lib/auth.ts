// Autenticación por contraseña simple. En login válido seteamos una cookie con
// un token = SHA-256(password:secret); el middleware la recomputa y compara.
// Usa Web Crypto (global `crypto.subtle`), disponible en el runtime edge del
// middleware y en Node 20+, así el mismo código sirve en ambos lados.

export const COOKIE = 'dp_auth';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Token esperado en la cookie según las variables de entorno. */
export async function tokenEsperado(): Promise<string> {
  const pass = process.env.DASHBOARD_PASSWORD ?? '';
  const secret = process.env.DASHBOARD_SESSION_SECRET ?? '';
  return sha256Hex(`${pass}:${secret}`);
}

/** ¿La contraseña ingresada es la correcta? */
export function passwordOk(intento: string): boolean {
  const pass = process.env.DASHBOARD_PASSWORD ?? '';
  // Comparación de longitud constante para no filtrar por timing.
  if (!pass || intento.length !== pass.length) return false;
  let diff = 0;
  for (let i = 0; i < pass.length; i++) diff |= intento.charCodeAt(i) ^ pass.charCodeAt(i);
  return diff === 0;
}

/** ¿La cookie recibida es válida? */
export async function cookieValida(valor: string | undefined): Promise<boolean> {
  if (!valor) return false;
  return valor === (await tokenEsperado());
}
