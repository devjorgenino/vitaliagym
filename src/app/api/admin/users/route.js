import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";

// Verificar que las variables de entorno existen
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Permisos requeridos
const PERMISSIONS = {
  USERS_CREATE: "users.create",
  USERS_DELETE: "users.delete",
  USERS_EDIT: "users.edit",
};

// Generar contraseña segura
function generateSecurePassword(length = 12) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

// Crear cliente admin solo si tenemos la service key
function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request) {
  try {
    // Clone request to read body for action check
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();
    
    // Check if this is a delete action (POST used to avoid 431 error with token in URL)
    if (body._action === "delete") {
      return handleDelete(request, body);
    }
    
    // Check if this is a patch/update action
    if (body._action === "patch") {
      return handlePatch(request, body);
    }
    
    // Otherwise, handle as create user
    return handleCreate(request, body);
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + error.message },
      { status: 500 }
    );
  }
}

async function handleCreate(request, body) {
  // Verificar permisos del usuario
  const authResult = await requirePermission(request, PERMISSIONS.USERS_CREATE);
  
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const supabaseAdmin = getAdminClient();
  
  if (!supabaseAdmin) {
    return NextResponse.json(
      { 
        error: "La creación de usuarios desde el admin requiere configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor." 
      },
      { status: 503 }
    );
  }

  const { email, full_name, phone, roleId } = body;

  // Validaciones
  if (!email) {
    return NextResponse.json(
      { error: "El email es requerido" },
      { status: 400 }
    );
  }

  if (!roleId) {
    return NextResponse.json(
      { error: "El rol es requerido" },
      { status: 400 }
    );
  }

  // Generar contraseña temporal
  const tempPassword = generateSecurePassword();

  // Crear usuario usando Admin API (no inicia sesión, no envía email de confirmación por defecto)
  const { data: userData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        full_name: full_name || "",
        phone: phone || "",
      },
    });

  if (createError) {
    console.error("Error creating user:", createError);
    return NextResponse.json(
      { error: createError.message },
      { status: 400 }
    );
  }

  if (!userData.user) {
    return NextResponse.json(
      { error: "No se pudo crear el usuario" },
      { status: 500 }
    );
  }

  // Crear perfil en tabla profiles
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userData.user.id,
      email,
      full_name: full_name || "",
      phone: phone || "",
    });

  if (profileError && profileError.code !== "PGRST116" && profileError.code !== "23505") {
    console.warn("Error creating profile:", profileError);
    // No fallar si profiles no existe o si hay duplicado
  }

  // Asignar rol
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({
      user_id: userData.user.id,
      role_id: roleId,
    });

  if (roleError) {
    console.warn("Error assigning role:", roleError);
    // Intentar eliminar el usuario si no se pudo asignar el rol
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    return NextResponse.json(
      { error: "Error al asignar rol: " + roleError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: userData.user.id,
      email: userData.user.email,
      full_name,
      phone,
    },
    tempPassword,
  });
}

async function handleDelete(request, body) {
  console.log("DELETE via POST /api/admin/users - Starting...");
  
  // Verificar permisos del usuario
  const authResult = await requirePermission(request, PERMISSIONS.USERS_DELETE);
  
  console.log("Auth result:", { authorized: authResult.authorized, error: authResult.error });
  
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const supabaseAdmin = getAdminClient();
  
  if (!supabaseAdmin) {
    return NextResponse.json(
      { 
        error: "La eliminación de usuarios requiere configurar SUPABASE_SERVICE_ROLE_KEY" 
      },
      { status: 503 }
    );
  }

  const userId = body.userId;

  console.log("Deleting user:", userId);

  if (!userId) {
    return NextResponse.json(
      { error: "userId es requerido" },
      { status: 400 }
    );
  }

  // Eliminar roles del usuario
  const { error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  
  console.log("Roles delete result:", rolesError ? rolesError.message : "OK");

  // Eliminar perfil
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", userId);
  
  console.log("Profile delete result:", profileError ? profileError.message : "OK");

  // Eliminar usuario de auth
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    userId
  );

  console.log("Auth delete result:", deleteError ? deleteError.message : "OK");

  if (deleteError) {
    console.error("Error deleting user from auth:", deleteError);
    return NextResponse.json(
      { error: deleteError.message },
      { status: 400 }
    );
  }

  console.log("User deleted successfully:", userId);
  return NextResponse.json({ success: true });
}

async function handlePatch(request, body) {
  const { userId, phone, full_name } = body;

  // Verificar permisos del usuario
  const authResult = await requirePermission(request, PERMISSIONS.USERS_EDIT);
  
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const supabaseAdmin = getAdminClient();
  
  if (!supabaseAdmin) {
    return NextResponse.json(
      { 
        error: "La actualización de usuarios requiere configurar SUPABASE_SERVICE_ROLE_KEY" 
      },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "userId es requerido" },
      { status: 400 }
    );
  }

  // Construir objeto de actualización
  const updateData = {};
  if (phone !== undefined) updateData.phone = phone;
  if (full_name !== undefined) updateData.full_name = full_name;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No hay datos para actualizar" },
      { status: 400 }
    );
  }

  console.log("Updating profile:", userId, updateData);

  // Actualizar perfil usando service role (bypasea RLS)
  const { data, error: profileError } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", userId)
    .select();

  if (profileError) {
    console.error("Error updating profile:", profileError);
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 }
    );
  }

  console.log("Profile updated:", data);
  return NextResponse.json({ success: true, data });
}

// PATCH - Actualizar perfil de usuario (bypasea RLS)
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { userId, phone, full_name } = body;

    // Verificar permisos del usuario
    const authResult = await requirePermission(request, PERMISSIONS.USERS_EDIT);
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const supabaseAdmin = getAdminClient();
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { 
          error: "La actualización de usuarios requiere configurar SUPABASE_SERVICE_ROLE_KEY" 
        },
        { status: 503 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId es requerido" },
        { status: 400 }
      );
    }

    // Construir objeto de actualización
    const updateData = {};
    if (phone !== undefined) updateData.phone = phone;
    if (full_name !== undefined) updateData.full_name = full_name;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No hay datos para actualizar" },
        { status: 400 }
      );
    }

    // Actualizar perfil usando service role (bypasea RLS)
    const { data, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select();

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + error.message },
      { status: 500 }
    );
  }
}

// Keep DELETE method as fallback (though it will have 431 issues with large tokens)
export async function DELETE(request) {
  try {
    console.log("DELETE /api/admin/users - Starting (legacy method)...");
    
    // Verificar permisos del usuario
    const authResult = await requirePermission(request, PERMISSIONS.USERS_DELETE);
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const supabaseAdmin = getAdminClient();
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { 
          error: "La eliminación de usuarios requiere configurar SUPABASE_SERVICE_ROLE_KEY" 
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId es requerido" },
        { status: 400 }
      );
    }

    // Eliminar roles del usuario
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // Eliminar perfil
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    // Eliminar usuario de auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + error.message },
      { status: 500 }
    );
  }
}
