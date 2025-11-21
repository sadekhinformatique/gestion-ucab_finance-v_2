import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Download, FileText, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;

const Rapports = () => {
  const { isAdmin } = useUserRole();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<"mensuel" | "annuel">("mensuel");
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [selectedYear, setSelectedYear] = useState(format(new Date(), "yyyy"));

  useEffect(() => {
    if (isAdmin) {
      fetchTransactions();
    }
  }, [isAdmin, selectedMonth, selectedYear, reportType]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let startDate: Date;
      let endDate: Date;

      if (reportType === "mensuel") {
        const monthDate = new Date(selectedMonth + "-01");
        startDate = startOfMonth(monthDate);
        endDate = endOfMonth(monthDate);
      } else {
        const yearDate = new Date(selectedYear + "-01-01");
        startDate = startOfYear(yearDate);
        endDate = endOfYear(yearDate);
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date_transaction", format(startDate, "yyyy-MM-dd"))
        .lte("date_transaction", format(endDate, "yyyy-MM-dd"))
        .eq("statut", "approuve")
        .order("date_transaction", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Erreur lors du chargement des transactions");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const entrees = transactions
      .filter((t) => t.type === "entree")
      .reduce((sum, t) => sum + Number(t.montant), 0);
    const sorties = transactions
      .filter((t) => t.type === "sortie")
      .reduce((sum, t) => sum + Number(t.montant), 0);
    const solde = entrees - sorties;

    const byCategory: Record<string, { entrees: number; sorties: number }> = {};
    transactions.forEach((t) => {
      if (!byCategory[t.categorie]) {
        byCategory[t.categorie] = { entrees: 0, sorties: 0 };
      }
      if (t.type === "entree") {
        byCategory[t.categorie].entrees += Number(t.montant);
      } else {
        byCategory[t.categorie].sorties += Number(t.montant);
      }
    });

    return { entrees, sorties, solde, byCategory };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(amount);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error("Aucune transaction à exporter");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Catégorie",
      "Libellé",
      "Montant",
      "Statut",
      "Numéro de reçu",
    ];

    const rows = transactions.map((t) => [
      format(new Date(t.date_transaction), "dd/MM/yyyy"),
      t.type === "entree" ? "Entrée" : "Sortie",
      t.categorie,
      t.libelle,
      t.montant.toString(),
      t.statut,
      t.numero_recu || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const filename =
      reportType === "mensuel"
        ? `rapport_mensuel_${selectedMonth}.csv`
        : `rapport_annuel_${selectedYear}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export CSV téléchargé");
  };

  const generatePDF = () => {
    if (transactions.length === 0) {
      toast.error("Aucune transaction à exporter");
      return;
    }

    const stats = calculateStats();
    const reportDate =
      reportType === "mensuel"
        ? format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: fr })
        : selectedYear;

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Rapport ${reportType === "mensuel" ? "Mensuel" : "Annuel"} - ${reportDate}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #2563eb;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 10px;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin: 20px 0;
            }
            .stat-card {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
            }
            .stat-label {
              font-size: 12px;
              color: #6b7280;
              margin-top: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #2563eb;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>Rapport ${reportType === "mensuel" ? "Mensuel" : "Annuel"} - ${reportDate}</h1>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(stats.entrees)}</div>
              <div class="stat-label">Total Entrées</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(stats.sorties)}</div>
              <div class="stat-label">Total Sorties</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(stats.solde)}</div>
              <div class="stat-label">Solde</div>
            </div>
          </div>

          <h2>Détail des transactions</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th>Libellé</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              ${transactions
                .map(
                  (t) => `
                <tr>
                  <td>${format(new Date(t.date_transaction), "dd/MM/yyyy")}</td>
                  <td>${t.type === "entree" ? "Entrée" : "Sortie"}</td>
                  <td>${t.categorie}</td>
                  <td>${t.libelle}</td>
                  <td>${formatCurrency(Number(t.montant))}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="footer">
            <p>Généré le ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
            <p>SAS Financier - Système de gestion financière associative</p>
          </div>
        </body>
      </html>
    `;

    // Open in new window for printing/downloading
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          toast.success("Rapport PDF généré");
        }, 250);
      };
    } else {
      toast.error("Veuillez autoriser les popups pour générer le PDF");
    }
  };

  const stats = calculateStats();

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return year.toString();
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return format(date, "yyyy-MM");
  });

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <Card>
            <CardHeader>
              <CardTitle>Accès restreint</CardTitle>
              <CardDescription>
                Seuls les administrateurs peuvent accéder aux rapports
              </CardDescription>
            </CardHeader>
          </Card>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Synthèses mensuelles & annuelles
            </div>
            <h1 className="text-3xl font-bold text-foreground">Rapports</h1>
            <p className="text-muted-foreground">
              Génération des bilans PDF, export des transactions et analyses automatiques
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Paramètres du rapport</CardTitle>
              <CardDescription>Sélectionnez le type et la période du rapport</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={reportType} onValueChange={(v) => setReportType(v as "mensuel" | "annuel")}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="mensuel">Rapport mensuel</TabsTrigger>
                  <TabsTrigger value="annuel">Rapport annuel</TabsTrigger>
                </TabsList>
                <TabsContent value="mensuel" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Mois</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            {format(new Date(month + "-01"), "MMMM yyyy", { locale: fr })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                <TabsContent value="annuel" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Année</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Entrées</CardTitle>
                <TrendingUp className="h-5 w-5 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.entrees)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Sorties</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.sorties)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Solde</CardTitle>
                <Wallet className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.solde)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>
                    {transactions.length} transaction(s) approuvée(s) pour cette période
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="default" className="gap-2" onClick={generatePDF}>
                    <FileText className="h-4 w-4" />
                    Exporter en PDF
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={exportToCSV}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.byCategory).length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Résumé par catégorie</h3>
                  <div className="grid gap-2">
                    {Object.entries(stats.byCategory).map(([category, amounts]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <span className="font-medium">{category}</span>
                        <div className="flex gap-4 text-sm">
                          {amounts.entrees > 0 && (
                            <span className="text-success">
                              Entrées: {formatCurrency(amounts.entrees)}
                            </span>
                          )}
                          {amounts.sorties > 0 && (
                            <span className="text-destructive">
                              Sorties: {formatCurrency(amounts.sorties)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default Rapports;
