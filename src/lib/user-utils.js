import client from "@/api/client";

export async function isUserAdmin() {
  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;

    const { data, error } = await client.rpc("check_is_admin", { check_user_id: user.id });

    if (error) {
      console.error("Error checking admin:", error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error("Error in isUserAdmin:", err);
    return false;
  }
}

export async function getUserCoachId() {
  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error getting coach id:", error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("Error in getUserCoachId:", err);
    return null;
  }
}

export async function isUserCoach() {
  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;

    const { data, error } = await client
      .from("user_roles")
      .select(`
        roles (
          name
        )
      `)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error checking coach:", error);
      return false;
    }

    return data?.some((ur) => ur.roles?.name === "Entrenador") || false;
  } catch (err) {
    console.error("Error in isUserCoach:", err);
    return false;
  }
}

export default { isUserAdmin, getUserCoachId, isUserCoach };