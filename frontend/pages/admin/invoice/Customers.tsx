import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit, Trash2, Mail, Phone, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Navigate, useNavigate } from "react-router-dom";

type Customer = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at?: string | Date;
  deleted_at?: string | null; // <-- tambahkan
};

type CreateCustomerRequest = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

export default function Customers() {
  // ========= Guard + headers =========
  const invoiceToken = localStorage.getItem("admin_invoice_token");
  if (!invoiceToken) return <Navigate to="/admin/invoice/login" replace />;
  const navigate = useNavigate();
  const authHeaders = { Authorization: `Bearer ${invoiceToken}` };

  // ========= State/UI =========
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetDelete, setTargetDelete] = useState<Customer | null>(null);
  const [deletingNow, setDeletingNow] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ========= Queries =========
  const { data, isLoading } = useQuery<{ customers: Customer[] }>({
    queryKey: ["invoice-customers", showDeleted],
    queryFn: async () => {
      const url = new URL(`${baseURL}/api/admin/invoice/customers`);
      if (showDeleted) url.searchParams.set("include_deleted", "1");
      const r = await fetch(url.toString(), { headers: authHeaders });
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        return { customers: [] };
      }
      const j = await r.json().catch(() => ({ customers: [] }));
      return Array.isArray(j?.customers) ? j : { customers: j ?? [] };
    },
  });

  // ========= Mutations =========
  const createMutation = useMutation({
    mutationFn: async (payload: CreateCustomerRequest) => {
      const r = await fetch(`${baseURL}/api/admin/invoice/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-customers"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Pelanggan berhasil ditambahkan" });
    },
    onError: () => {
      toast({ title: "Gagal menambahkan pelanggan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (
      payload: { id: number } & Partial<CreateCustomerRequest>
    ) => {
      const { id, ...rest } = payload;
      const r = await fetch(`${baseURL}/api/admin/invoice/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(rest),
      });
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-customers"] });
      setEditingCustomer(null);
      toast({ title: "Pelanggan berhasil diperbarui" });
    },
    onError: () => {
      toast({ title: "Gagal memperbarui pelanggan", variant: "destructive" });
    },
  });

  // delete → sekarang terima {id, hard}
  const deleteMutation = useMutation({
    mutationFn: async ({ id, hard }: { id: number; hard: boolean }) => {
      const r = await fetch(
        `${baseURL}/api/admin/invoice/customers/${id}?hard=${hard ? "1" : "0"}`,
        { method: "DELETE", headers: authHeaders }
      );
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        throw new Error("Unauthorized");
      }
      if (r.status === 404) return { alreadyGone: true };
      if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
      return r.json().catch(() => ({}));
    },
    onSuccess: (res, vars) => {
      // Hilangkan dari cache tampilan normal (showDeleted=false)
      queryClient.setQueryData<{ customers: Customer[] }>(
        ["invoice-customers", false],
        (old) =>
          old
            ? { customers: old.customers.filter((c) => c.id !== vars.id) }
            : old
      );

      // Untuk tampilan "Tampilkan yang dihapus" (showDeleted=true)
      if (vars.hard) {
        // hard delete -> benar2 hilang
        queryClient.setQueryData<{ customers: Customer[] }>(
          ["invoice-customers", true],
          (old) =>
            old
              ? { customers: old.customers.filter((c) => c.id !== vars.id) }
              : old
        );
      } else {
        // soft delete -> tandai deleted_at supaya muncul di view 'showDeleted'
        queryClient.setQueryData<{ customers: Customer[] }>(
          ["invoice-customers", true],
          (old) =>
            old
              ? {
                  customers: old.customers.map((c) =>
                    c.id === vars.id
                      ? { ...c, deleted_at: new Date().toISOString() }
                      : c
                  ),
                }
              : old
        );
      }

      // tetap refetch agar sinkron dengan server
      queryClient.invalidateQueries({
        queryKey: ["invoice-customers"],
        exact: false,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Gagal menghapus pelanggan",
        description: e?.message || "Error",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(
        `${baseURL}/api/admin/invoice/customers/${id}/restore`,
        { method: "PATCH", headers: authHeaders }
      );
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-customers"] });
      toast({ title: "Pelanggan dipulihkan" });
    },
    onError: (e: any) => {
      toast({
        title: "Gagal memulihkan",
        description: e?.message || "Error",
        variant: "destructive",
      });
    },
  });

  // ========= Handlers =========
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: CreateCustomerRequest = {
      name: (formData.get("name") as string) || "",
      email: (formData.get("email") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
    };
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const customers: Customer[] = data?.customers ?? [];
  // tampilkan yang dihapus hanya saat checkbox dicentang
  const visibleCustomers = showDeleted
    ? customers
    : customers.filter((c) => !c.deleted_at);

  const doDelete = async (mode: "soft" | "hard") => {
    if (!targetDelete) return;
    setDeletingNow(true);
    try {
      const res: any = await deleteMutation.mutateAsync({
        id: targetDelete.id,
        hard: mode === "hard",
      });
      toast({
        title: res?.alreadyGone
          ? "Pelanggan sudah terhapus"
          : mode === "hard"
          ? "Pelanggan dihapus permanen"
          : "Pelanggan dihapus (soft)",
        description: targetDelete.name,
      });
    } catch (e: any) {
      toast({
        title: "Gagal menghapus pelanggan",
        description: e?.message || "Error",
        variant: "destructive",
      });
    } finally {
      setDeletingNow(false);
      setConfirmOpen(false);
      setTargetDelete(null);
    }
  };

  const restoreCustomer = async (id: number) => {
    setRestoringId(id);
    try {
      await restoreMutation.mutateAsync(id);
    } finally {
      setRestoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ========= UI =========
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Pelanggan
          </h1>
          <p className="text-gray-600 mt-2 md:mt-3 text-base md:text-lg">
            Kelola database pelanggan Anda
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Tampilkan yang dihapus
          </label>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Pelanggan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md mx-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  Tambah Pelanggan Baru
                </DialogTitle>
              </DialogHeader>
              <CustomerForm
                onSubmit={handleSubmit}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {visibleCustomers.map((customer) => (
          <Card
            key={customer.id}
            className={
              "transition-all duration-300 hover:shadow-xl hover:scale-105 border-0 shadow-lg overflow-hidden " +
              (customer.deleted_at && showDeleted
                ? "opacity-70 ring-1 ring-red-200"
                : "")
            }
          >
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  <Users className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                  <span className="truncate text-sm md:text-base">
                    {customer.name}
                  </span>
                  {customer.deleted_at && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/20">
                      Deleted
                    </span>
                  )}
                </div>
                <div className="flex space-x-1 md:space-x-2 ml-2">
                  {customer.deleted_at ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={restoringId === customer.id}
                      onClick={() => restoreCustomer(customer.id)}
                      className="text-white hover:bg-white/20 p-1 md:p-2"
                      title="Pulihkan pelanggan yang di-soft delete"
                    >
                      {restoringId === customer.id
                        ? "Memulihkan..."
                        : "Pulihkan"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCustomer(customer)}
                        className="text-white hover:bg-white/20 p-1 md:p-2"
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTargetDelete(customer);
                          setConfirmOpen(true);
                        }}
                        className="text-white hover:bg-white/20 p-1 md:p-2"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 bg-white">
              {customer.email && (
                <div className="flex items-center text-xs md:text-sm text-gray-600 p-2 bg-blue-50 rounded-lg">
                  <Mail className="h-3 w-3 md:h-4 md:w-4 mr-2 md:mr-3 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center text-xs md:text-sm text-gray-600 p-2 bg-green-50 rounded-lg">
                  <Phone className="h-3 w-3 md:h-4 md:w-4 mr-2 md:mr-3 text-green-500 flex-shrink-0" />
                  <span className="truncate">{customer.phone}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start text-xs md:text-sm text-gray-600 p-2 bg-yellow-50 rounded-lg">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4 mr-2 md:mr-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                  <span className="line-clamp-2">{customer.address}</span>
                </div>
              )}
              {!customer.email && !customer.phone && !customer.address && (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-xs md:text-sm">
                    Tidak ada informasi kontak
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleCustomers.length === 0 && (
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardContent className="text-center py-12 md:py-16 bg-white px-4">
            <Users className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-6 text-base md:text-lg">
              Belum ada pelanggan
            </p>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Tambah pelanggan pertama
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {editingCustomer && (
        <Dialog
          open={!!editingCustomer}
          onOpenChange={() => setEditingCustomer(null)}
        >
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Edit Pelanggan
              </DialogTitle>
            </DialogHeader>
            <CustomerForm
              customer={editingCustomer}
              onSubmit={handleSubmit}
              isLoading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete: Soft vs Hard */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pelanggan?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Tindakan ini tidak bisa dibatalkan.</p>
                <p>
                  <b>Soft delete</b> akan menyembunyikan pelanggan tetapi data
                  tetap tersimpan.
                  <br />
                  <b>Hard delete</b> menghapus akun pelanggan secara permanen.
                </p>
                <p className="mt-2">
                  Target: <b>{targetDelete?.name}</b>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:justify-between">
            <AlertDialogCancel disabled={deletingNow}>Batal</AlertDialogCancel>
            <div className="flex gap-2">
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={deletingNow}
                  onClick={(e) => {
                    e.preventDefault();
                    doDelete("soft");
                  }}
                >
                  {deletingNow ? "Menghapus..." : "Soft delete"}
                </Button>
              </AlertDialogAction>
              <AlertDialogAction asChild>
                <Button
                  className="bg-red-700 hover:bg-red-800"
                  disabled={deletingNow}
                  onClick={(e) => {
                    e.preventDefault();
                    doDelete("hard");
                  }}
                >
                  {deletingNow ? "Menghapus..." : "Hard delete"}
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type CustomerFormProps = {
  customer?: Customer;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
};

function CustomerForm({ customer, onSubmit, isLoading }: CustomerFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
      <div>
        <Label htmlFor="name" className="text-sm font-medium">
          Nama *
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={customer?.name}
          required
          placeholder="Nama pelanggan"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="email" className="text-sm font-medium">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={customer?.email}
          placeholder="pelanggan@example.com"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="phone" className="text-sm font-medium">
          Telepon
        </Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={customer?.phone}
          placeholder="+62 812 3456 7890"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="address" className="text-sm font-medium">
          Alamat
        </Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={customer?.address}
          placeholder="Alamat pelanggan"
          rows={3}
          className="mt-1"
        />
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full sm:w-auto"
        >
          {isLoading ? "Menyimpan..." : customer ? "Perbarui" : "Tambah"}
        </Button>
      </div>
    </form>
  );
}
