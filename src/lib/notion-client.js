const API_URL = "/api/notion/workouts";

export async function getWorkouts() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error fetching workouts");
    }

    return data.workouts || [];
  } catch (error) {
    console.error("Error fetching workouts:", error.message);
    throw error;
  }
}

export async function getWorkoutById(workoutId) {
  try {
    const allWorkouts = await getWorkouts();
    return allWorkouts.find((w) => w.id === workoutId);
  } catch (error) {
    console.error("Error fetching workout:", error);
    throw error;
  }
}

export async function getWorkoutsByCoach(coachId) {
  try {
    const allWorkouts = await getWorkouts();
    return allWorkouts.filter((workout) => {
      return workout.properties?.entrenadore?.some((coach) => coach.id === coachId);
    });
  } catch (error) {
    console.error("Error fetching workouts by coach:", error);
    throw error;
  }
}

export default { getWorkouts, getWorkoutById, getWorkoutsByCoach };