import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users,
  ArrowUpCircle,
  ArrowDownCircle 
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEntrees: 0,
    totalSorties: 0,
    solde: 0,
    nombreMembres: 0,
    transactionsEnAttente: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch transactions stats
        const { data: transactions } = await supabase
          .from("transactions")
          .select("type, montant, statut");

        const entrees = transactions
          ?.filter(t => t.type === "entree" && t.statut === "approuve")
          .reduce((sum, t) => sum + Number(t.montant), 0) || 0;

        const sorties = transactions
          ?.filter(t => t.type === "sortie" && t.statut === "approuve")
          .reduce((sum, t) => sum + Number(t.montant), 0) || 0;

        const enAttente = transactions
          ?.filter(t => t.statut === "en_attente").length || 0;

        // Fetch members count
        const { count: membresCount } = await supabase
          .from("membres")
          .select("*", { count: "exact", head: true });

        setStats({
          totalEntrees: entrees,
          totalSorties: sorties,
          solde: entrees - sorties,
          nombreMembres: membresCount || 0,
          transactionsEnAttente: enAttente,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(amount);
  };

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
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Tableau de bord
            </h1>
            <p className="text-muted-foreground">
              Vue d'ensemble de la situation financière
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Solde Total
                </CardTitle>
                <Wallet className="w-5 h-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.solde)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Entrées - Sorties
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Total Entrées
                </CardTitle>
                <ArrowUpCircle className="w-5 h-5 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.totalEntrees)}
                </div>
                <div className="flex items-center text-xs text-success mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Cotisations, dons, ventes
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Total Sorties
                </CardTitle>
                <ArrowDownCircle className="w-5 h-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.totalSorties)}
                </div>
                <div className="flex items-center text-xs text-destructive mt-1">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  Dépenses approuvées
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Membres
                </CardTitle>
                <Users className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.nombreMembres}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.transactionsEnAttente} transactions en attente
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Bienvenue sur votre tableau de bord</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Voici un aperçu rapide de votre situation financière. Utilisez le menu de navigation
                pour accéder aux différentes fonctionnalités :
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Transactions</strong> : Gérez les entrées et sorties d'argent</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Membres</strong> : Consultez et gérez les membres de l'association</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Rapports</strong> : Générez des bilans mensuels et annuels</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default Dashboard;
