import { ShoppingCart, LogOut, LineChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Plus,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

const BASE = "/admin/invoice";

const navigation = [
  { name: "Dashboard", href: `${BASE}`, icon: LayoutDashboard, end: true }, // end=true biar exact
  { name: "Pelanggan", href: `${BASE}/customers`, icon: Users },
  { name: "Invoice", href: `${BASE}/invoices`, icon: FileText },
  { name: "Pembelian Bahan", href: `${BASE}/purchases`, icon: ShoppingCart },
  { name: "Rekapan Penjualan", href: `${BASE}/sales`, icon: LineChart },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // === Logout Admin Invoice ===
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function handleLogout() {
    localStorage.removeItem("admin_invoice_token"); // hapus token admin invoice
    queryClient.clear(); // bersihkan cache react-query
    navigate("/admin/invoice/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div
          className={cn(
            "bg-white shadow-xl border-r border-gray-200 transition-all duration-300 ease-in-out relative",
            sidebarOpen ? "w-64" : "w-16",
            "sticky top-0 self-start h-screen"
          )}
        >
          <div
            className={cn(
              "transition-all duration-300",
              sidebarOpen ? "p-4 md:p-6" : "p-2"
            )}
          >
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "flex items-center space-x-3 transition-opacity duration-200",
                  sidebarOpen ? "opacity-100" : "opacity-0"
                )}
              >
                <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                  <Settings className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-gray-900">
                    Admin Invoice
                  </h1>
                  <p className="text-xs text-gray-500">Sistem Manajemen</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "p-2 hover:bg-gray-100 rounded-lg transition-all duration-200",
                  !sidebarOpen && "w-full justify-center"
                )}
              >
                <Menu className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>

          <nav className="mt-4 md:mt-6 px-3">
            <div className="space-y-2">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.end as any} // hanya untuk Dashboard
                  title={!sidebarOpen ? item.name : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:scale-105",
                      !sidebarOpen && "justify-center"
                    )
                  }
                >
                  <item.icon
                    className={cn(
                      "flex-shrink-0 transition-colors duration-200",
                      sidebarOpen
                        ? "mr-3 h-4 w-4 md:h-5 md:w-5"
                        : "h-4 w-4 md:h-5 md:w-5"
                    )}
                  />
                  {sidebarOpen && (
                    <span className="transition-opacity duration-200 text-sm md:text-base">
                      {item.name}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200">
              <NavLink
                to={`${BASE}/invoices/new`}
                className={cn(
                  "group flex items-center px-3 py-3 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105",
                  !sidebarOpen && "justify-center"
                )}
                title={!sidebarOpen ? "Buat Invoice" : undefined}
              >
                <Plus
                  className={cn(
                    "flex-shrink-0",
                    sidebarOpen
                      ? "mr-3 h-4 w-4 md:h-5 md:w-5"
                      : "h-4 w-4 md:h-5 md:w-5"
                  )}
                />
                {sidebarOpen && (
                  <span className="text-sm md:text-base">Buat Invoice</span>
                )}
              </NavLink>
            </div>
            <div className="mt-3 px-3">
              <Button
                variant="outline"
                onClick={handleLogout}
                className={cn(
                  "w-full justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50",
                  !sidebarOpen && "px-0"
                )}
                title={!sidebarOpen ? "Logout" : undefined}
              >
                <LogOut className="h-4 w-4" />
                {sidebarOpen && <span>Logout</span>}
              </Button>
            </div>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <main className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
