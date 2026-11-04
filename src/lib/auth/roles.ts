export const ROLES = ["learner", "instructor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "instructor":
      return "/instructor";
    default:
      return "/dashboard";
  }
}

export const roleLabel: Record<Role, string> = {
  learner: "Learner",
  instructor: "Instructor",
  admin: "Organization admin",
};
