import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Limpia todas las cookies de sesion de Supabase del response.
 * Cuando una sesion esta corrupta (tokens viejos, refresh fallido),
 * borrar las cookies fuerza un login limpio en vez de dejar al
 * browser atrapado con cookies invalidas.
 */
function clearSupabaseCookies(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const cookieNames = request.cookies
    .getAll()
    .map((c) => c.name)
    .filter(
      (name) =>
        name.startsWith("sb-") ||
        name.includes("supabase") ||
        name.includes("auth-token")
    );

  for (const name of cookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Setear cookies en el request (para que Server Components las lean)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Setear cookies en el response (para que el browser las guarde)
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el JWT contra GoTrue (no solo lee la session local)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Si no hay usuario autenticado y no estamos en /login, redirigir
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);

    // Si habia cookies de sesion pero getUser fallo, la sesion esta
    // corrupta. Limpiar cookies para que el proximo login arranque limpio.
    const hadSession = request.cookies
      .getAll()
      .some(
        (c) =>
          c.name.startsWith("sb-") ||
          c.name.includes("supabase") ||
          c.name.includes("auth-token")
      );
    if (hadSession && error) {
      clearSupabaseCookies(request, redirect);
    }

    return redirect;
  }

  // Si hay usuario y quiere /admin, verificar que sea super_admin
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    const role = user.app_metadata?.role;
    if (role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Si hay usuario y estamos en /login, redirigir al dashboard
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
