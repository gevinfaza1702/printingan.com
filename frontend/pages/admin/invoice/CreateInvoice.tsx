import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import backend from "~backend/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, ArrowLeft, FileText, Calculator } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount_type?: "percent" | "flat";
  discount_value?: number; // percent or Rp sesuai type
}

interface CreateInvoiceRequest {
  customer_id: number;
  issue_date: Date;
  due_date: Date;
  tax_rate: number;
  notes?: string;
  items: InvoiceItem[];
  invoice_discount_type?: "percent" | "flat";
  invoice_discount_value?: number;
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // --- GUARD & headers untuk module Admin Invoice ---
  const invoiceToken = localStorage.getItem("admin_invoice_token");

  if (!invoiceToken) return <Navigate to="/admin/invoice/login" replace />;

  const headers = { Authorization: `Bearer ${invoiceToken}` };
  const baseURL =
    (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

  const [customerId, setCustomerId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [taxRate, setTaxRate] = useState(11); // Default PPN 11%
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 1,
      unit_price: 0,
      discount_type: "percent",
      discount_value: 0,
    },
  ]);
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<
    "percent" | "flat"
  >("percent");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState<number>(0);

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => backend.invoice.listCustomers(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateInvoiceRequest) => {
      const r = await fetch(`${baseURL}/api/admin/invoice/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(data),
      });

      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
      return r.json();
    },
    onSuccess: (invoice: any) => {
      toast({ title: "Invoice berhasil dibuat" });
      navigate(`/admin/invoice/invoices/${invoice.id}`);
    },
    onError: (error) => {
      console.error("Create invoice error:", error);
      toast({ title: "Gagal membuat invoice", variant: "destructive" });
    },
  });

  const addItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        discount_type: "percent",
        discount_value: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const base = (item.quantity || 0) * (item.unit_price || 0);
    const type = item.discount_type || "percent";
    const val = item.discount_value || 0;
    if (type === "percent") {
      return Math.max(0, base - base * (val / 100));
    }
    return Math.max(0, base - val);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * (taxRate / 100);
  };

  const calculateInvoiceDiscount = () => {
    const subtotal = calculateSubtotal();
    if (invoiceDiscountType === "percent")
      return subtotal * ((invoiceDiscountValue || 0) / 100);
    return invoiceDiscountValue || 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const disc = calculateInvoiceDiscount();
    return subtotal - disc + calculateTaxOn(subtotal - disc);
  };

  const calculateTaxOn = (base: number) => base * (taxRate / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast({ title: "Silakan pilih pelanggan", variant: "destructive" });
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.description.trim() && item.quantity > 0 && item.unit_price >= 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Silakan tambahkan minimal satu item yang valid",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      customer_id: parseInt(customerId),
      issue_date: new Date(issueDate),
      due_date: new Date(dueDate),
      tax_rate: taxRate,
      notes: notes.trim() || undefined,
      items: validItems,
      invoice_discount_type: invoiceDiscountType,
      invoice_discount_value: invoiceDiscountValue,
    });
  };

  const customers = customersData?.customers || [];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/invoice/invoices")}
          className="hover:bg-gray-100 self-start"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Invoice
        </Button>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Buat Invoice
          </h1>
          <p className="text-gray-600 mt-2 md:mt-3 text-base md:text-lg">
            Buat invoice baru untuk pelanggan Anda
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2" />
              Detail Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <Label htmlFor="customer" className="text-sm font-medium">
                  Pelanggan *
                </Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih pelanggan" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer: any) => (
                      <SelectItem
                        key={customer.id}
                        value={customer.id.toString()}
                      >
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="taxRate" className="text-sm font-medium">
                  Tarif Pajak (%)
                </Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <Label htmlFor="issueDate" className="text-sm font-medium">
                  Tanggal Terbit *
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="dueDate" className="text-sm font-medium">
                  Tanggal Jatuh Tempo *
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm font-medium">
                Catatan
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan untuk invoice"
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center text-lg md:text-xl">
                <Plus className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                Item Invoice
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="bg-white text-green-600 hover:bg-green-50 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 bg-white">
            <div className="space-y-4 md:space-y-6">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-4 p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Label className="text-sm font-medium">Deskripsi *</Label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, "description", e.target.value)
                        }
                        placeholder="Deskripsi item"
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Jumlah *</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "quantity",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Harga Satuan (Rp) *
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "unit_price",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Diskon</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <Select
                          value={item.discount_type || "percent"}
                          onValueChange={(val: "percent" | "flat") =>
                            updateItem(index, "discount_type", val)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="flat">Rp</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discount_value || 0}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "discount_value",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Total</Label>
                      <div className="p-3 bg-blue-50 rounded-lg border text-right font-bold text-blue-700 mt-1 text-sm md:text-base">
                        Rp {calculateItemTotal(item).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>

                  {items.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus Item
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <Calculator className="h-4 w-4 md:h-5 md:w-5 mr-2" />
              Ringkasan Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 bg-white">
            <div className="space-y-3 md:space-y-4 text-base md:text-lg">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Subtotal:</span>
                <span className="font-bold">
                  Rp {calculateSubtotal().toLocaleString("id-ID")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Diskon Invoice</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Select
                      value={invoiceDiscountType}
                      onValueChange={(v: "percent" | "flat") =>
                        setInvoiceDiscountType(v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="flat">Rp</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={invoiceDiscountValue}
                      onChange={(e) =>
                        setInvoiceDiscountValue(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">
                  Diskon Invoice (
                  {invoiceDiscountType === "percent"
                    ? invoiceDiscountValue + "%"
                    : "Rp " + invoiceDiscountValue.toLocaleString("id-ID")}
                  ):
                </span>
                <span className="font-bold text-blue-700">
                  - Rp {calculateInvoiceDiscount().toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">Pajak ({taxRate}%):</span>
                <span className="font-bold text-blue-700">
                  Rp{" "}
                  {calculateTaxOn(
                    calculateSubtotal() - calculateInvoiceDiscount()
                  ).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between text-lg md:text-xl font-bold border-t-2 pt-4 p-3 bg-green-50 rounded-lg">
                <span>Total:</span>
                <span className="text-green-700">
                  Rp {calculateTotal().toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/invoice/invoices")}
            className="px-6 md:px-8 w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-6 md:px-8 w-full sm:w-auto"
          >
            {createMutation.isPending ? "Membuat..." : "Buat Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
