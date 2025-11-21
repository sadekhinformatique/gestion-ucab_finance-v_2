import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Users, 
  Trash2, 
  Edit, 
  ArrowLeftRight,
  Database,
  Image,
  Save
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type UserProfile = Tables<"profiles"> & {
  user_roles?: { role: "president" | "tresorier" | "membre" }[];
  user_id?: string;
};

type Transaction = Tables<"transactions">;
type Membre = Tables<"membres">;

const Parametrage = () => {
  const { user } = useAuth();
  const { isAdmin, isPresident } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");

  // Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<"president" | "tresorier" | "membre">("membre");

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Members state
  const [membres, setMembres] = useState<Membre[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalMembres: 0,
    totalEntrees: 0,
    totalSorties: 0,
  });

  // App settings state
  const [appSettings, setAppSettings] = useState({
    appName: "SAS Financier",
    appLogoUrl: "",
  });
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin, activeTab]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchTransactions(),
        fetchMembres(),
        fetchStats(),
        fetchAppSettings(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithRoles: UserProfile[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          return {
            ...profile,
            user_roles: roles ? [roles] : [],
            user_id: profile.id,
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Erreur lors du chargement des transactions");
    }
  };

  const fetchMembres = async () => {
    try {
      const { data, error } = await supabase
        .from("membres")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMembres(data || []);
    } catch (error) {
      console.error("Error fetching membres:", error);
      toast.error("Erreur lors du chargement des membres");
    }
  };

  const fetchAppSettings = async () => {
    try {
      const { data: appNameSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_name")
        .single();

      const { data: appLogoSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_logo_url")
        .single();

      setAppSettings({
        appName: appNameSetting?.setting_value || "SAS Financier",
        appLogoUrl: appLogoSetting?.setting_value || "",
      });
      setLogoPreview(appLogoSetting?.setting_value || "");
    } catch (error) {
      console.error("Error fetching app settings:", error);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !user) return null;

    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Delete old logo if exists
      if (appSettings.appLogoUrl) {
        const oldPath = appSettings.appLogoUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("app-logos").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("app-logos")
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("app-logos").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erreur lors de l'upload du logo");
      return null;
    }
  };

  const handleSaveAppSettings = async () => {
    if (!user || !isAdmin) {
      toast.error("Permission insuffisante");
      return;
    }

    try {
      let logoUrl = appSettings.appLogoUrl;

      // Upload logo if file selected
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      // Update app name
      const { error: nameError } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: "app_name",
          setting_value: appSettings.appName,
        });

      if (nameError) throw nameError;

      // Update logo URL
      const { error: logoError } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: "app_logo_url",
          setting_value: logoUrl,
        });

      if (logoError) throw logoError;

      toast.success("Paramètres de l'application mis à jour");
      setIsSettingsDialogOpen(false);
      setLogoFile(null);
      fetchAppSettings();
      // Reload page to update app name and logo
      window.location.reload();
    } catch (error: any) {
      console.error("Error saving app settings:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer le logo ?")) {
      return;
    }

    try {
      if (appSettings.appLogoUrl) {
        const filePath = appSettings.appLogoUrl.split("/").pop();
        if (filePath) {
          await supabase.storage.from("app-logos").remove([filePath]);
        }
      }

      const { error } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: "app_logo_url",
          setting_value: "",
        });

      if (error) throw error;

      toast.success("Logo supprimé avec succès");
      setAppSettings({ ...appSettings, appLogoUrl: "" });
      setLogoPreview("");
      fetchAppSettings();
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting logo:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const fetchStats = async () => {
    try {
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: transactionsCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });

      const { count: membresCount } = await supabase
        .from("membres")
        .select("*", { count: "exact", head: true });

      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, montant, statut");

      const entrees = transactions
        ?.filter((t) => t.type === "entree" && t.statut === "approuve")
        .reduce((sum, t) => sum + Number(t.montant), 0) || 0;

      const sorties = transactions
        ?.filter((t) => t.type === "sortie" && t.statut === "approuve")
        .reduce((sum, t) => sum + Number(t.montant), 0) || 0;

      setStats({
        totalUsers: usersCount || 0,
        totalTransactions: transactionsCount || 0,
        totalMembres: membresCount || 0,
        totalEntrees: entrees,
        totalSorties: sorties,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !user) {
      toast.error("Erreur : utilisateur non sélectionné");
      return;
    }

    if (selectedUser.id === user.id && newRole !== "president" && isPresident) {
      toast.error("Vous ne pouvez pas modifier votre propre rôle de président");
      return;
    }

    try {
      // Supprimer l'ancien rôle
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.id);

      if (deleteError) throw deleteError;

      // Ajouter le nouveau rôle
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUser.id,
          role: newRole,
        });

      if (insertError) throw insertError;

      toast.success(`Rôle mis à jour : ${newRole}`);
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Erreur lors de la mise à jour du rôle");
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${email} ?\nCette action supprimera son profil et ses rôles.`)) {
      return;
    }

    if (userId === user?.id) {
      toast.error("Vous ne pouvez pas supprimer votre propre compte");
      return;
    }

    try {
      // Supprimer les rôles de l'utilisateur
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      // Supprimer le profil (la suppression en cascade supprimera aussi les données liées)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("Profil utilisateur supprimé avec succès");
      toast.info("Note: L'utilisateur devra être supprimé manuellement depuis le tableau de bord Supabase si nécessaire");
      fetchUsers();
      fetchStats();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette transaction ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      toast.success("Transaction supprimée avec succès");
      fetchTransactions();
      fetchStats();
    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const handleDeleteMembre = async (membreId: string, nom: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le membre ${nom} ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("membres")
        .delete()
        .eq("id", membreId);

      if (error) throw error;

      toast.success("Membre supprimé avec succès");
      fetchMembres();
      fetchStats();
    } catch (error: any) {
      console.error("Error deleting membre:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(amount);
  };

  const getRoleBadge = (role: string | undefined) => {
    const roleMap: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      president: { variant: "default", label: "Président" },
      tresorier: { variant: "secondary", label: "Trésorier" },
      membre: { variant: "outline", label: "Membre" },
    };

    const roleInfo = roleMap[role || "membre"] || roleMap.membre;
    return (
      <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
    );
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <Card>
            <CardHeader>
              <CardTitle>Accès restreint</CardTitle>
              <CardDescription>
                Seuls les administrateurs peuvent accéder aux paramètres
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
              <Settings className="h-4 w-4" />
              Administration complète du système
            </div>
            <h1 className="text-3xl font-bold text-foreground">Paramétrage</h1>
            <p className="text-muted-foreground">
              Gestion complète des utilisateurs, transactions, membres et statistiques système
            </p>
          </div>

          {/* Statistiques globales */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Membres</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMembres}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Entrées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalEntrees)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Sorties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalSorties)}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Utilisateurs
              </TabsTrigger>
              <TabsTrigger value="transactions">
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="membres">
                <Users className="h-4 w-4 mr-2" />
                Membres
              </TabsTrigger>
              <TabsTrigger value="app-settings">
                <Settings className="h-4 w-4 mr-2" />
                App
              </TabsTrigger>
              <TabsTrigger value="system">
                <Database className="h-4 w-4 mr-2" />
                Système
              </TabsTrigger>
            </TabsList>

            {/* Tab Utilisateurs */}
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des utilisateurs</CardTitle>
                  <CardDescription>
                    Gérer les rôles et supprimer des utilisateurs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Prénom</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((userProfile) => {
                          const userRole = userProfile.user_roles?.[0]?.role || "membre";
                          return (
                            <TableRow key={userProfile.id}>
                              <TableCell className="font-medium">{userProfile.email}</TableCell>
                              <TableCell>{userProfile.nom || "-"}</TableCell>
                              <TableCell>{userProfile.prenom || "-"}</TableCell>
                              <TableCell>{getRoleBadge(userRole)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Dialog
                                    open={
                                      isRoleDialogOpen && selectedUser?.id === userProfile.id
                                    }
                                    onOpenChange={(open) => {
                                      setIsRoleDialogOpen(open);
                                      if (open) {
                                        setSelectedUser(userProfile);
                                        setNewRole(userRole as any);
                                      } else {
                                        setSelectedUser(null);
                                      }
                                    }}
                                  >
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="gap-1">
                                        <Edit className="h-3 w-3" />
                                        Modifier rôle
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Modifier le rôle</DialogTitle>
                                        <DialogDescription>
                                          Changer le rôle de {userProfile.email}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="role">Nouveau rôle</Label>
                                          <Select
                                            value={newRole}
                                            onValueChange={(value: any) => setNewRole(value)}
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="president">Président</SelectItem>
                                              <SelectItem value="tresorier">Trésorier</SelectItem>
                                              <SelectItem value="membre">Membre</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <Button
                                          variant="outline"
                                          onClick={() => setIsRoleDialogOpen(false)}
                                        >
                                          Annuler
                                        </Button>
                                        <Button onClick={handleUpdateRole}>Confirmer</Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                  {userProfile.id !== user?.id && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteUser(userProfile.id, userProfile.email)}
                                      className="gap-1 text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Supprimer
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Transactions */}
            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des transactions</CardTitle>
                  <CardDescription>
                    Visualiser et supprimer des transactions (100 dernières)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {new Date(transaction.date_transaction).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell className="capitalize">{transaction.type}</TableCell>
                            <TableCell>{transaction.categorie}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {transaction.libelle}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(Number(transaction.montant))}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.statut === "approuve"
                                    ? "default"
                                    : transaction.statut === "en_attente"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {transaction.statut.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTransaction(transaction.id)}
                                className="gap-1 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                                Supprimer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Membres */}
            <TabsContent value="membres" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des membres</CardTitle>
                  <CardDescription>
                    Visualiser et supprimer des membres
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identifiant</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Prénom</TableHead>
                          <TableHead>Filière</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membres.map((membre) => (
                          <TableRow key={membre.id}>
                            <TableCell className="font-medium">{membre.identifiant}</TableCell>
                            <TableCell>{membre.nom}</TableCell>
                            <TableCell>{membre.prenom}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{membre.filiere}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleDeleteMembre(
                                    membre.id,
                                    `${membre.prenom} ${membre.nom}`
                                  )
                                }
                                className="gap-1 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                                Supprimer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Paramètres App */}
            <TabsContent value="app-settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Paramètres de l'application</CardTitle>
                      <CardDescription>
                        Configurez le nom et le logo de l'application
                      </CardDescription>
                    </div>
                    <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <Edit className="h-4 w-4" />
                          Modifier
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Modifier les paramètres de l'application</DialogTitle>
                          <DialogDescription>
                            Changez le nom et le logo de l'application
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="app-name">Nom de l'application</Label>
                            <Input
                              id="app-name"
                              value={appSettings.appName}
                              onChange={(e) =>
                                setAppSettings({ ...appSettings, appName: e.target.value })
                              }
                              placeholder="SAS Financier"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="app-logo">Logo de l'application</Label>
                            <Input
                              id="app-logo"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoFileChange}
                            />
                            {logoPreview && (
                              <div className="mt-4">
                                <p className="text-sm text-muted-foreground mb-2">
                                  Aperçu du logo :
                                </p>
                                <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                                  <img
                                    src={logoPreview}
                                    alt="Logo preview"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                            )}
                            {appSettings.appLogoUrl && !logoFile && (
                              <div className="mt-4">
                                <p className="text-sm text-muted-foreground mb-2">
                                  Logo actuel :
                                </p>
                                <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                                  <img
                                    src={appSettings.appLogoUrl}
                                    alt="Current logo"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleDeleteLogo}
                                  className="mt-2"
                                >
                                  Supprimer le logo
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsSettingsDialogOpen(false);
                              setLogoFile(null);
                              setLogoPreview(appSettings.appLogoUrl);
                            }}
                          >
                            Annuler
                          </Button>
                          <Button onClick={handleSaveAppSettings} className="gap-2">
                            <Save className="h-4 w-4" />
                            Enregistrer
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom actuel</Label>
                      <p className="font-medium">{appSettings.appName}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Logo actuel</Label>
                      {appSettings.appLogoUrl ? (
                        <div className="w-32 h-32 border rounded-lg overflow-hidden">
                          <img
                            src={appSettings.appLogoUrl}
                            alt="App logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucun logo configuré</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Système */}
            <TabsContent value="system" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informations système</CardTitle>
                  <CardDescription>
                    Statistiques et informations sur le système
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Version de l'application</Label>
                      <p className="text-sm text-muted-foreground">1.0.0</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Base de données</Label>
                      <p className="text-sm text-muted-foreground">Supabase</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Total des transactions approuvées</Label>
                      <p className="text-sm text-muted-foreground">
                        {
                          transactions.filter((t) => t.statut === "approuve").length
                        } sur {transactions.length}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Solde actuel</Label>
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(stats.totalEntrees - stats.totalSorties)}
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        fetchAllData();
                        toast.success("Données actualisées");
                      }}
                    >
                      Actualiser les données
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default Parametrage;

