import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeftRight, PlusCircle, Upload, CheckCircle2, XCircle, Clock, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;

const Transactions = () => {
  const { user } = useAuth();
  const { isTresorier, isAdmin } = useUserRole();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    type: "entree" as "entree" | "sortie",
    categorie: "",
    montant: "",
    libelle: "",
    date_transaction: format(new Date(), "yyyy-MM-dd"),
    matricule: "",
    numero_recu: "",
    responsable_fonction: "",
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Erreur lors du chargement des transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadFile = async (transactionId: string): Promise<string | null> => {
    if (!selectedFile) return null;

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${transactionId}-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("receipts").getPublicUrl(filePath);

      // Save receipt record
      const { error: receiptError } = await supabase
        .from("receipts")
        .insert({
          transaction_id: transactionId,
          file_url: data.publicUrl,
          file_name: selectedFile.name,
        });

      if (receiptError) throw receiptError;

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erreur lors de l'upload du fichier");
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    if (!isTresorier) {
      toast.error("Seuls les trésoriers peuvent créer des transactions");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create transaction
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          type: formData.type,
          categorie: formData.categorie,
          montant: parseFloat(formData.montant),
          libelle: formData.libelle,
          date_transaction: formData.date_transaction,
          matricule: formData.matricule || null,
          numero_recu: formData.numero_recu || null,
          responsable_fonction: formData.responsable_fonction || null,
          created_by: user.id,
          statut: "en_attente",
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Upload file if provided
      if (selectedFile && transaction) {
        await uploadFile(transaction.id);
      }

      toast.success("Transaction créée avec succès");
      setIsDialogOpen(false);
      setFormData({
        type: "entree",
        categorie: "",
        montant: "",
        libelle: "",
        date_transaction: format(new Date(), "yyyy-MM-dd"),
        matricule: "",
        numero_recu: "",
        responsable_fonction: "",
      });
      setSelectedFile(null);
      fetchTransactions();
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      toast.error(error.message || "Erreur lors de la création de la transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (transactionId: string) => {
    if (!user || !isAdmin) {
      toast.error("Permission insuffisante");
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          statut: "approuve",
          approuve_par: user.id,
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast.success("Transaction approuvée");
      fetchTransactions();
    } catch (error: any) {
      console.error("Error approving transaction:", error);
      toast.error(error.message || "Erreur lors de l'approbation");
    }
  };

  const handleReject = async (transactionId: string) => {
    if (!user || !isAdmin) {
      toast.error("Permission insuffisante");
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          statut: "rejete",
          approuve_par: user.id,
        })
        .eq("id", transactionId);

      if (error) throw error;

      toast.success("Transaction rejetée");
      fetchTransactions();
    } catch (error: any) {
      console.error("Error rejecting transaction:", error);
      toast.error(error.message || "Erreur lors du rejet");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(amount);
  };

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      approuve: "default",
      en_attente: "secondary",
      rejete: "destructive",
    };

    const icons: Record<string, typeof CheckCircle2> = {
      approuve: CheckCircle2,
      en_attente: Clock,
      rejete: XCircle,
    };

    const Icon = icons[statut] || Clock;
    const variant = variants[statut] || "secondary";

    return (
      <Badge variant={variant} className="gap-1 capitalize inline-flex items-center">
        <Icon className="h-3 w-3" />
        {statut.replace("_", " ")}
      </Badge>
    );
  };

  const getCategories = (type: "entree" | "sortie") => {
    if (type === "entree") {
      return ["Cotisation", "Don", "Sponsoring", "Vente", "Autre"];
    }
    return ["Logistique", "Événement", "Frais administratifs", "Matériel", "Autre"];
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <ArrowLeftRight className="h-4 w-4" />
                Flux financier complet
              </div>
              <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
              <p className="text-muted-foreground">
                Suivi des entrées et sorties, pièces justificatives et workflow d'approbation
              </p>
            </div>
            {isTresorier && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Ajouter une transaction
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nouvelle transaction</DialogTitle>
                    <DialogDescription>
                      Remplissez le formulaire pour créer une nouvelle transaction
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="type">Type *</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value: "entree" | "sortie") =>
                            setFormData({ ...formData, type: value, categorie: "" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="entree">Entrée</SelectItem>
                            <SelectItem value="sortie">Sortie</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categorie">Catégorie *</Label>
                        <Select
                          value={formData.categorie}
                          onValueChange={(value) =>
                            setFormData({ ...formData, categorie: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            {getCategories(formData.type).map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="montant">Montant (XOF) *</Label>
                        <Input
                          id="montant"
                          type="number"
                          step="0.01"
                          value={formData.montant}
                          onChange={(e) =>
                            setFormData({ ...formData, montant: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_transaction">Date *</Label>
                        <Input
                          id="date_transaction"
                          type="date"
                          value={formData.date_transaction}
                          onChange={(e) =>
                            setFormData({ ...formData, date_transaction: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="libelle">Libellé *</Label>
                      <Textarea
                        id="libelle"
                        value={formData.libelle}
                        onChange={(e) =>
                          setFormData({ ...formData, libelle: e.target.value })
                        }
                        required
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="matricule">Matricule</Label>
                        <Input
                          id="matricule"
                          value={formData.matricule}
                          onChange={(e) =>
                            setFormData({ ...formData, matricule: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numero_recu">Numéro de reçu</Label>
                        <Input
                          id="numero_recu"
                          value={formData.numero_recu}
                          onChange={(e) =>
                            setFormData({ ...formData, numero_recu: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="responsable_fonction">Responsable / Fonction</Label>
                      <Input
                        id="responsable_fonction"
                        value={formData.responsable_fonction}
                        onChange={(e) =>
                          setFormData({ ...formData, responsable_fonction: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="file">Pièce justificative (optionnel)</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          Fichier sélectionné: {selectedFile.name}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        disabled={isSubmitting}
                      >
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Création..." : "Créer la transaction"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des transactions</CardTitle>
              <CardDescription>
                {transactions.length} transaction(s) au total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune transaction enregistrée
                </div>
              ) : (
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
                        {isAdmin && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.date_transaction), "dd MMM yyyy", {
                              locale: fr,
                            })}
                          </TableCell>
                          <TableCell className="capitalize">
                            {transaction.type === "entree" ? (
                              <Badge variant="default" className="gap-1 inline-flex items-center">
                                <ArrowLeftRight className="h-3 w-3 rotate-90" />
                                Entrée
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 inline-flex items-center">
                                <ArrowLeftRight className="h-3 w-3 -rotate-90" />
                                Sortie
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{transaction.categorie}</TableCell>
                          <TableCell className="max-w-xs truncate">{transaction.libelle}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(transaction.montant))}
                          </TableCell>
                          <TableCell>{getStatusBadge(transaction.statut)}</TableCell>
                          {isAdmin && transaction.statut === "en_attente" && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApprove(transaction.id)}
                                  className="gap-1"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approuver
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReject(transaction.id)}
                                  className="gap-1 text-destructive"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Rejeter
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default Transactions;
