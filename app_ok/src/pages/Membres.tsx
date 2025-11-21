import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Membre = Tables<"membres">;

const filieres = [
  "ANNEE PREPARATOIRE",
  "INFORMATIQUE DE GESTION",
  "ADMINISTRATION",
  "ELECTROMECQNIQUE",
] as const;

const niveaux = ["L1", "L2", "L3"] as const;

const ANNEE_PREPARATOIRE = "ANNEE PREPARATOIRE";

type FiliereOption = (typeof filieres)[number];
type NiveauOption = (typeof niveaux)[number];

const normalizeFiliere = (value?: string | null): FiliereOption => {
  if (!value) return filieres[0];
  const upperValue = value.toUpperCase();
  // Vérifier si c'est l'année préparatoire (avec ou sans niveau)
  if (upperValue.includes("ANNEE PREPARATOIRE") || upperValue.includes("ANNÉE PRÉPARATOIRE")) {
    return ANNEE_PREPARATOIRE;
  }
  return filieres.find((filiere) => upperValue.includes(filiere)) ?? filieres[0];
};

const normalizeNiveau = (value?: string | null): NiveauOption => {
  return niveaux.find((niveau) => niveau === value) ?? "L1";
};

const extractFiliereNiveau = (combined?: string | null) => {
  if (!combined) {
    return {
      filiere: ANNEE_PREPARATOIRE,
      niveau: "L1" as NiveauOption,
    };
  }

  const upperCombined = combined.toUpperCase();
  // Si c'est l'année préparatoire, pas de niveau
  if (upperCombined.includes("ANNEE PREPARATOIRE") || upperCombined.includes("ANNÉE PRÉPARATOIRE")) {
    return {
      filiere: ANNEE_PREPARATOIRE,
      niveau: "L1" as NiveauOption, // Valeur par défaut, ne sera pas utilisé
    };
  }

  const [rawFiliere, rawNiveau] = combined.split(" - ").map((part) => part.trim());
  return {
    filiere: normalizeFiliere(rawFiliere),
    niveau: normalizeNiveau(rawNiveau),
  };
};

const formatFiliereNiveau = (filiere: FiliereOption, niveau: NiveauOption) => {
  // L'année préparatoire n'a pas de niveau
  if (filiere === ANNEE_PREPARATOIRE) {
    return filiere;
  }
  return `${filiere} - ${niveau}`;
};

const Membres = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMembre, setEditingMembre] = useState<Membre | null>(null);

  const [formData, setFormData] = useState({
    identifiant: "",
    nom: "",
    prenom: "",
    date_naissance: "",
    filiere: ANNEE_PREPARATOIRE,
    niveau: "L1" as NiveauOption,
    sexe: "M" as "M" | "F",
    numero_dossier: "",
    ine: "",
  });

  useEffect(() => {
    fetchMembres();
  }, []);

  const fetchMembres = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("membres")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMembres(data || []);
    } catch (error) {
      console.error("Error fetching membres:", error);
      toast.error("Erreur lors du chargement des membres");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      identifiant: "",
      nom: "",
      prenom: "",
      date_naissance: "",
      filiere: ANNEE_PREPARATOIRE,
      niveau: "L1" as NiveauOption,
      sexe: "M",
      numero_dossier: "",
      ine: "",
    });
    setEditingMembre(null);
  };

  const handleOpenDialog = (membre?: Membre) => {
    if (membre) {
      setEditingMembre(membre);
      const { filiere, niveau } = extractFiliereNiveau(membre.filiere);
      setFormData({
        identifiant: membre.identifiant,
        nom: membre.nom,
        prenom: membre.prenom,
        date_naissance: membre.date_naissance,
        filiere,
        niveau,
        sexe: membre.sexe as "M" | "F",
        numero_dossier: membre.numero_dossier,
        ine: membre.ine,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !isAdmin) {
      toast.error("Permission insuffisante");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingMembre) {
        // Update existing membre
        const { error } = await supabase
          .from("membres")
          .update({
            identifiant: formData.identifiant,
            nom: formData.nom,
            prenom: formData.prenom,
            date_naissance: formData.date_naissance,
            filiere: formatFiliereNiveau(formData.filiere, formData.niveau),
            sexe: formData.sexe,
            numero_dossier: formData.numero_dossier,
            ine: formData.ine,
          })
          .eq("id", editingMembre.id);

        if (error) throw error;
        toast.success("Membre mis à jour avec succès");
      } else {
        // Create new membre
        const { error } = await supabase.from("membres").insert({
          identifiant: formData.identifiant,
          nom: formData.nom,
          prenom: formData.prenom,
          date_naissance: formData.date_naissance,
          filiere: formatFiliereNiveau(formData.filiere, formData.niveau),
          sexe: formData.sexe,
          numero_dossier: formData.numero_dossier,
          ine: formData.ine,
        });

        if (error) throw error;
        toast.success("Membre créé avec succès");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchMembres();
    } catch (error: any) {
      console.error("Error saving membre:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (membreId: string) => {
    if (!user || !isAdmin) {
      toast.error("Permission insuffisante");
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce membre ?")) {
      return;
    }

    try {
      const { error } = await supabase.from("membres").delete().eq("id", membreId);

      if (error) throw error;
      toast.success("Membre supprimé avec succès");
      fetchMembres();
    } catch (error: any) {
      console.error("Error deleting membre:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
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
                <Users className="h-4 w-4" />
                Registre complet des membres
              </div>
              <h1 className="text-3xl font-bold text-foreground">Membres</h1>
              <p className="text-muted-foreground">
                Profils détaillés, suivi des cotisations et rattachement aux transactions
              </p>
            </div>
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" onClick={() => handleOpenDialog()}>
                    <UserPlus className="h-4 w-4" />
                    Ajouter un membre
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingMembre ? "Modifier le membre" : "Nouveau membre"}
                    </DialogTitle>
                    <DialogDescription>
                      Remplissez le formulaire pour {editingMembre ? "modifier" : "créer"} un membre
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="identifiant">Identifiant *</Label>
                        <Input
                          id="identifiant"
                          value={formData.identifiant}
                          onChange={(e) =>
                            setFormData({ ...formData, identifiant: e.target.value })
                          }
                          required
                          disabled={!!editingMembre}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numero_dossier">Numéro de dossier *</Label>
                        <Input
                          id="numero_dossier"
                          value={formData.numero_dossier}
                          onChange={(e) =>
                            setFormData({ ...formData, numero_dossier: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nom">Nom *</Label>
                        <Input
                          id="nom"
                          value={formData.nom}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prenom">Prénom *</Label>
                        <Input
                          id="prenom"
                          value={formData.prenom}
                          onChange={(e) =>
                            setFormData({ ...formData, prenom: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date_naissance">Date de naissance *</Label>
                        <Input
                          id="date_naissance"
                          type="date"
                          value={formData.date_naissance}
                          onChange={(e) =>
                            setFormData({ ...formData, date_naissance: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sexe">Sexe *</Label>
                        <Select
                          value={formData.sexe}
                          onValueChange={(value: "M" | "F") =>
                            setFormData({ ...formData, sexe: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">Masculin</SelectItem>
                            <SelectItem value="F">Féminin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="filiere">Filière *</Label>
                        <Select
                          value={formData.filiere}
                          onValueChange={(value) =>
                            setFormData({ ...formData, filiere: value as FiliereOption })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une filière" />
                          </SelectTrigger>
                          <SelectContent>
                            {filieres.map((filiere) => (
                              <SelectItem key={filiere} value={filiere}>
                                {filiere}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.filiere !== ANNEE_PREPARATOIRE && (
                        <div className="space-y-2">
                          <Label htmlFor="niveau">Niveau *</Label>
                          <Select
                            value={formData.niveau}
                            onValueChange={(value) =>
                              setFormData({ ...formData, niveau: value as NiveauOption })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un niveau" />
                            </SelectTrigger>
                            <SelectContent>
                              {niveaux.map((niveau) => (
                                <SelectItem key={niveau} value={niveau}>
                                  {niveau}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ine">INE *</Label>
                      <Input
                        id="ine"
                        value={formData.ine}
                        onChange={(e) => setFormData({ ...formData, ine: e.target.value })}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          resetForm();
                        }}
                        disabled={isSubmitting}
                      >
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting
                          ? editingMembre
                            ? "Modification..."
                            : "Création..."
                          : editingMembre
                            ? "Modifier"
                            : "Créer"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des membres</CardTitle>
              <CardDescription>
                {membres.length} membre(s) enregistré(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {membres.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun membre enregistré
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identifiant</TableHead>
                        <TableHead>Nom & Prénom</TableHead>
                        <TableHead>Filière</TableHead>
                        <TableHead>Niveau</TableHead>
                        <TableHead>Numéro de dossier</TableHead>
                        <TableHead>INE</TableHead>
                        {isAdmin && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membres.map((membre) => {
                        const { filiere, niveau } = extractFiliereNiveau(membre.filiere);
                        return (
                          <TableRow key={membre.id}>
                          <TableCell className="font-medium">
                            {membre.identifiant}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {membre.prenom.charAt(0)}
                                  {membre.nom.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">
                                  {membre.prenom} {membre.nom}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {membre.sexe === "M" ? "Masculin" : "Féminin"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{filiere}</Badge>
                          </TableCell>
                          <TableCell>
                            {filiere === ANNEE_PREPARATOIRE ? (
                              <span className="text-muted-foreground text-sm">-</span>
                            ) : (
                              <Badge variant="outline">{niveau}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{membre.numero_dossier}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {membre.ine}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenDialog(membre)}
                                  className="gap-1"
                                >
                                  <Edit className="h-3 w-3" />
                                  Modifier
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(membre.id)}
                                  className="gap-1 text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Supprimer
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })}
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

export default Membres;
