import { useState } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser, useDeleteUser, useAdminResetPassword,
  getListUsersQueryKey,
  type User,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, KeyRound, Trash2, Pencil } from "lucide-react";

const roleColors: Record<string, string> = {
  admin:         "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  doctor:        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  staff:         "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  radiographer:  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

const ROLES = ["admin", "doctor", "staff", "radiographer"] as const;

type EditForm = {
  fullName: string;
  role: string;
  email: string;
  phone: string;
  registrationNumber: string;
  specialization: string;
  consultingHours: string;
};

function blankEdit(u: User): EditForm {
  return {
    fullName:           u.fullName ?? "",
    role:               u.role,
    email:              u.email ?? "",
    phone:              u.phone ?? "",
    registrationNumber: u.registrationNumber ?? "",
    specialization:     u.specialization ?? "",
    consultingHours:    u.consultingHours ?? "",
  };
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate]     = useState(false);
  const [resetUserId, setResetUserId]   = useState<string | null>(null);
  const [newPassword, setNewPassword]   = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget]     = useState<User | null>(null);
  const [editForm, setEditForm]         = useState<EditForm | null>(null);

  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState({
    username: "", password: "", role: "doctor",
    fullName: "", email: "", phone: "", registrationNumber: "", specialization: "", consultingHours: "",
  });

  const { data, isLoading } = useListUsers(
    { role: roleFilter || undefined },
    { query: { queryKey: getListUsersQueryKey({ role: roleFilter || undefined }) } }
  );
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const resetMutation  = useAdminResetPassword();

  const users = data?.data ?? [];

  const handleCreate = () => {
    createMutation.mutate({ data: form as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        toast({ title: "User created" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setShowCreate(false);
        setForm({ username: "", password: "", role: "doctor", fullName: "", email: "", phone: "", registrationNumber: "", specialization: "", consultingHours: "" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: msg ?? "Error creating user", variant: "destructive" });
      },
    });
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setEditForm(blankEdit(u));
  };

  const handleEdit = () => {
    if (!editTarget || !editForm) return;
    updateMutation.mutate(
      { id: editTarget.id, data: editForm as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "User updated" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setEditTarget(null);
          setEditForm(null);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast({ title: msg ?? "Error updating user", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        toast({ title: "User deleted" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Error deleting user", variant: "destructive" }),
    });
  };

  const handleDeactivate = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => {
        toast({ title: isActive ? "User deactivated" : "User activated" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    });
  };

  const handleReset = () => {
    if (!resetUserId || !newPassword) return;
    resetMutation.mutate({ id: resetUserId, data: { newPassword } }, {
      onSuccess: () => {
        toast({ title: "Password reset" });
        setResetUserId(null);
        setNewPassword("");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} users</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="btn-create-user">
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="flex gap-2">
        {["", "admin", "doctor", "staff", "radiographer"].map(role => (
          <button key={role} onClick={() => setRoleFilter(role)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${roleFilter === role ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {role || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : users.map(u => (
                  <tr key={u.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {u.fullName}
                      {u.specialization && (
                        <span className="block text-xs text-muted-foreground">{u.specialization}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roleColors[u.role] ?? ""}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? "default" : "secondary"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResetUserId(u.id)}>
                          <KeyRound className="h-3 w-3 mr-1" /> Reset
                        </Button>
                        <Button
                          size="sm"
                          variant={u.isActive ? "destructive" : "outline"}
                          onClick={() => handleDeactivate(u.id, u.isActive)}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ id: u.id, name: u.fullName })}
                          data-testid={`btn-delete-user-${u.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit User dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) { setEditTarget(null); setEditForm(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User — <span className="font-mono text-base">{editTarget?.username}</span></DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editForm.fullName}
                    onChange={e => setEditForm(f => f && ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={v => setEditForm(f => f && ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={editForm.email}
                    onChange={e => setEditForm(f => f && ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={e => setEditForm(f => f && ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reg. Number</Label>
                  <Input
                    value={editForm.registrationNumber}
                    onChange={e => setEditForm(f => f && ({ ...f, registrationNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Specialization</Label>
                  <Input
                    value={editForm.specialization}
                    onChange={e => setEditForm(f => f && ({ ...f, specialization: e.target.value }))}
                  />
                </div>
                {editForm.role === "doctor" && (
                  <div className="space-y-1.5 col-span-1 sm:col-span-2">
                    <Label>Consulting Hours</Label>
                    <Input
                      placeholder="e.g. Mon–Fri 9am–5pm, Sat 9am–1pm"
                      value={editForm.consultingHours}
                      onChange={e => setEditForm(f => f && ({ ...f, consultingHours: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setEditTarget(null); setEditForm(null); }}>Cancel</Button>
                <Button onClick={handleEdit} disabled={updateMutation.isPending || !editForm.fullName.trim()}>
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create User dialog ─────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select defaultValue="doctor" onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reg. Number (Doctors)</Label>
                <Input value={form.registrationNumber} onChange={e => setForm(f => ({ ...f, registrationNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} />
              </div>
              {form.role === "doctor" && (
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <Label>Consulting Hours</Label>
                  <Input
                    placeholder="e.g. Mon–Fri 9am–5pm, Sat 9am–1pm"
                    value={form.consultingHours}
                    onChange={e => setForm(f => ({ ...f, consultingHours: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password dialog ──────────────────────────────────────────── */}
      <Dialog open={!!resetUserId} onOpenChange={() => setResetUserId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetUserId(null)}>Cancel</Button>
              <Button onClick={handleReset} disabled={!newPassword || resetMutation.isPending}>Reset</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?{" "}
              This will <span className="font-semibold text-destructive">permanently delete</span> their account
              and all associated login credentials. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting…" : "Delete User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
