import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { JSX } from "react";
import Purchases from "./pages/admin/invoice/Purchases";
import Layout from "./components/Layout";

/* ===== Admin Invoice pages ===== */
import AdminInvoiceLogin from "./pages/admin/invoice/login";
import AdminInvoiceDashboard from "./pages/admin/invoice/Dashboard";
import Invoices from "./pages/admin/invoice/Invoices";
import CreateInvoice from "./pages/admin/invoice/CreateInvoice";
import InvoiceDetail from "./pages/admin/invoice/InvoiceDetail";
import Customers from "./pages/admin/invoice/Customers";
import SalesReport from "@/pages/admin/invoice/SalesReport";

/* ===== Client pages ===== */
import ClientLogin from "./pages/client/Login";
import ClientRegister from "./pages/client/Register";
import ClientDashboard from "./pages/client/Dashboard";

/* ===== Admin Verifier pages ===== */
import VerifierLogin from "./pages/admin/verifier/login";
import VerifierDashboard from "./pages/admin/verifier"; // index.tsx
import AdminClientsPage from "./pages/admin/verifier/clients";
import Vendors from "@/pages/admin/verifier/Vendors";
const queryClient = new QueryClient();

/* ---------- Guards ---------- */
function AdminVerifierGuard({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("admin_verifier_token");
  return token ? children : <Navigate to="/admin/verifier/login" replace />;
}

function AdminInvoiceGuard({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("admin_invoice_token");
  return token ? children : <Navigate to="/admin/invoice/login" replace />;
}

function ClientDashboardGuard() {
  const token = localStorage.getItem("client_token");
  return token ? <ClientDashboard /> : <Navigate to="/client/login" replace />;
}

function RoleAwareLanding() {
  const ai = localStorage.getItem("admin_invoice_token");
  const av = localStorage.getItem("admin_verifier_token");
  const ct = localStorage.getItem("client_token");

  if (ai) return <Navigate to="/admin/invoice" replace />;
  if (av) return <Navigate to="/admin/verifier" replace />;
  if (ct) return <Navigate to="/client" replace />;
  // default publik: arahkan ke halaman login client (atau halaman pilih peran)
  return <Navigate to="/client/login" replace />;
}

/* ---------- App ---------- */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* ===== Admin Invoice ===== */}
          <Route path="/admin/invoice/login" element={<AdminInvoiceLogin />} />
          <Route
            path="/admin/invoice/invoices/grouped/:clientId/:day"
            element={<InvoiceDetail />}
          />
          <Route
            path="/admin/invoice/invoices/:id"
            element={<InvoiceDetail />}
          />
          <Route path="/" element={<RoleAwareLanding />} />
          <Route path="*" element={<RoleAwareLanding />} />
          <Route
            path="/admin/invoice"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <AdminInvoiceDashboard />
                </Layout>
              </AdminInvoiceGuard>
            }
          />
          <Route
            path="/admin/invoice/invoices"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <Invoices />
                </Layout>
              </AdminInvoiceGuard>
            }
          />
          <Route
            path="/admin/invoice/invoices/new"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <CreateInvoice />
                </Layout>
              </AdminInvoiceGuard>
            }
          />
          <Route
            path="/admin/invoice/invoices/:id"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <InvoiceDetail />
                </Layout>
              </AdminInvoiceGuard>
            }
          />
          <Route
            path="/admin/invoice/customers"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <Customers />
                </Layout>
              </AdminInvoiceGuard>
            }
          />
          <Route
            path="/admin/invoice/sales"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <SalesReport />
                </Layout>
              </AdminInvoiceGuard>
            }
          />

          {/* ===== Admin Verifier ===== */}
          <Route path="/admin/verifier/login" element={<VerifierLogin />} />
          <Route
            path="/admin/verifier"
            element={
              <AdminVerifierGuard>
                <VerifierDashboard />
              </AdminVerifierGuard>
            }
          />
          <Route path="/admin/verifier/vendors" element={<Vendors />} />
          <Route
            path="/admin/verifier/clients"
            element={
              <AdminVerifierGuard>
                <AdminClientsPage />
              </AdminVerifierGuard>
            }
          />
          <Route
            path="/admin/invoice/purchases"
            element={
              <AdminInvoiceGuard>
                <Layout>
                  <Purchases />
                </Layout>
              </AdminInvoiceGuard>
            }
          />

          {/* ===== Client ===== */}
          <Route path="/client/login" element={<ClientLogin />} />
          <Route path="/client/register" element={<ClientRegister />} />
          <Route path="/client" element={<ClientDashboardGuard />} />

          {/* ===== Default / 404 ===== */}
          <Route
            path="/"
            element={<Navigate to="/admin/invoice/login" replace />}
          />
          <Route
            path="*"
            element={<Navigate to="/admin/invoice/login" replace />}
          />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
