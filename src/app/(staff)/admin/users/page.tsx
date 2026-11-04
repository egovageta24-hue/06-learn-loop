import { format } from "date-fns";
import type { Metadata } from "next";
import { CreateUserForm, UserRowControls } from "@/components/admin/admin-controls";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/roles";
import { listOrgUsers } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const admin = await requireRole("admin");
  const users = await listOrgUsers(admin.orgId);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Add people, change roles, and suspend access. Suspension takes effect immediately.</p>
      </header>

      <section aria-labelledby="add-heading" className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 id="add-heading" className="text-lg font-bold">
          Add a user
        </h2>
        <CreateUserForm />
      </section>

      <section aria-labelledby="people-heading" className="space-y-3">
        <h2 id="people-heading" className="text-lg font-bold">
          People ({users.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Courses owned</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role &amp; access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">
                      {u.name} {u.id === admin.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "secondary" : "destructive"}>{u.status === "active" ? roleLabel[u.role] : "Suspended"}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{u.enrollments}</TableCell>
                  <TableCell className="tabular-nums">{u.ownedCourses}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{format(u.createdAt, "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <UserRowControls userId={u.id} name={u.name} role={u.role} status={u.status} isSelf={u.id === admin.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
