import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project reference from Supabase URL
function getProjectRef() {
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

/**
 * Extract auth token from request body (for POST/PUT/PATCH)
 * @param {Request} request - The incoming request
 * @returns {Promise<string|null>}
 */
async function getTokenFromBody(request) {
  try {
    // Clone the request to avoid consuming the body
    const cloned = request.clone();
    const body = await cloned.json();
    return body?._authToken || null;
  } catch {
    return null;
  }
}

/**
 * Extract auth token from query parameters (for GET/DELETE)
 * @param {Request} request - The incoming request
 * @returns {string|null}
 */
function getTokenFromQuery(request) {
  try {
    const url = new URL(request.url);
    return url.searchParams.get('_authToken');
  } catch {
    return null;
  }
}

/**
 * Extract auth token from cookies (fallback)
 * @returns {Promise<string|null>}
 */
async function getTokenFromCookies() {
  try {
    const cookieStore = await cookies();
    const projectRef = getProjectRef();
    
    // Try different cookie name patterns that Supabase uses
    const cookiePatterns = [
      projectRef ? `sb-${projectRef}-auth-token` : null,
      'sb-access-token',
      'supabase-auth-token',
    ].filter(Boolean);

    for (const pattern of cookiePatterns) {
      const cookie = cookieStore.get(pattern);
      if (cookie?.value) {
        try {
          const parsed = JSON.parse(cookie.value);
          if (parsed.access_token) {
            return parsed.access_token;
          }
        } catch {
          return cookie.value;
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify user authentication from request
 * Extracts token from body (POST), query params (DELETE), or cookies (fallback)
 * Returns the user if authenticated, null otherwise
 */
export async function verifyAuth(request) {
  try {
    let accessToken = null;
    const method = request.method?.toUpperCase();

    // 1. For POST/PUT/PATCH: Get token from request body
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      accessToken = await getTokenFromBody(request);
    }
    
    // 2. For GET/DELETE: Get token from query parameters
    if (!accessToken && ['GET', 'DELETE'].includes(method)) {
      accessToken = getTokenFromQuery(request);
    }
    
    // 3. Fallback: Try cookies (for SSR or middleware scenarios)
    if (!accessToken) {
      accessToken = await getTokenFromCookies();
    }

    if (!accessToken) {
      return { user: null, error: "No hay sesion activa" };
    }

    // Create a client with the user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return { user: null, error: error?.message || "Token invalido" };
    }

    return { user, error: null, supabase };
  } catch (error) {
    console.error("Auth verification error:", error);
    return { user: null, error: error.message };
  }
}

/**
 * Get user permissions from database
 * Requires the admin client for server-side operations
 */
export async function getUserPermissions(userId) {
  if (!supabaseServiceKey) {
    return { permissions: [], roles: [], error: "Service key not configured" };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Get user roles
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        roles (
          id,
          name,
          is_system_role
        )
      `)
      .eq("user_id", userId);

    if (rolesError) {
      return { permissions: [], roles: [], error: rolesError.message };
    }

    const roles = userRoles?.map((ur) => ur.roles) || [];
    const roleIds = roles.map((r) => r.id);

    // Get permissions for these roles
    let permissions = [];
    if (roleIds.length > 0) {
      const { data: permData, error: permError } = await supabaseAdmin
        .from("role_permissions")
        .select(`
          permissions (
            id,
            name,
            module
          )
        `)
        .in("role_id", roleIds);

      if (permError) {
        return { permissions: [], roles, error: permError.message };
      }

      permissions = permData?.map((rp) => rp.permissions.name) || [];
    }

    return { permissions, roles, error: null };
  } catch (error) {
    return { permissions: [], roles: [], error: error.message };
  }
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permissions, requiredPermission) {
  return permissions.includes(requiredPermission);
}

/**
 * Check if user has admin role
 */
export function isAdmin(roles) {
  return roles.some((r) => r.name === "Admin");
}

/**
 * Verify user has required permission for an API route
 * Returns { authorized: true } or { authorized: false, response: NextResponse }
 */
export async function requirePermission(request, requiredPermission) {
  const { user, error: authError } = await verifyAuth(request);

  if (!user) {
    return {
      authorized: false,
      status: 401,
      error: authError || "No autenticado",
    };
  }

  const { permissions, roles, error: permError } = await getUserPermissions(user.id);

  if (permError) {
    console.error("Permission check error:", permError);
    // If we can't check permissions, deny access for security
    return {
      authorized: false,
      status: 500,
      error: "Error al verificar permisos",
    };
  }

  // Admins have all permissions
  if (isAdmin(roles)) {
    return { authorized: true, user, permissions, roles };
  }

  // Check specific permission
  if (!hasPermission(permissions, requiredPermission)) {
    return {
      authorized: false,
      status: 403,
      error: `Permiso requerido: ${requiredPermission}`,
    };
  }

  return { authorized: true, user, permissions, roles };
}
