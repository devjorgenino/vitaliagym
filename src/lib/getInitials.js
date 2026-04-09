export const getInitials = (name) => {
  if (!name || typeof name !== "string") return "U";
  const names = name.trim().split(" ");
  if (names.length === 1 && names[0] === "") return "U";
  if (names.length === 1) {
    return names[0].substring(0, 2).toUpperCase();
  }
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
};
