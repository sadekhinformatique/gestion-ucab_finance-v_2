import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, Shield, TrendingUp, TrendingDown, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Membre = Tables<"membres">;
type Transaction = Tables<"transactions">;

const Profil = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membre, setMembre] = useState<Membre | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    transactionsCreees: 0,
    totalEntrees: 0,
    totalSorties: 0,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
        setPhotoPreview(profileData.profile_photo_url || "");

        // Fetch membre linked to this user
        const { data: membreData } = await supabase
          .from("membres")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (membreData) {
          setMembre(membreData);
        }
      }

      // Fetch user transactions (created by or approved by)
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .or(`created_by.eq.${user.id},approuve_par.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (transactionsData) {
        setUserTransactions(transactionsData);

        const entrees = transactionsData
          .filter((t) => t.type === "entree" && t.statut === "approuve")
          .reduce((sum, t) => sum + Number(t.montant), 0);

        const sorties = transactionsData
          .filter((t) => t.type === "sortie" && t.statut === "approuve")
          .reduce((sum, t) => sum + Number(t.montant), 0);

        setStats({
          transactionsCreees: transactionsData.filter((t) => t.created_by === user.id).length,
          totalEntrees: entrees,
          totalSorties: sorties,
        });
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(amount);
  };

  const getRoleBadge = (role: string | null) => {
    const roleMap: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
      president: { variant: "default", label: "Président" },
      tresorier: { variant: "secondary", label: "Trésorier" },
      membre: { variant: "outline", label: "Membre" },
    };

    const roleInfo = roleMap[role || "membre"] || roleMap.membre;
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>;
  };

  const extractFiliereNiveau = (combined?: string | null) => {
    if (!combined) return { filiere: "-", niveau: "-" };
    if (combined.includes("ANNEE PREPARATOIRE")) {
      return { filiere: "ANNEE PREPARATOIRE", niveau: "-" };
    }
    const parts = combined.split(" - ");
    return {
      filiere: parts[0] || "-",
      niveau: parts[1] || "-",
    };
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Veuillez sélectionner une image");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("L'image doit faire moins de 5MB");
        return;
      }

      setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !user) {
      toast.error("Aucune photo sélectionnée");
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Delete old photo if exists
      if (profile?.profile_photo_url) {
        const oldPath = profile.profile_photo_url.split("/").pop();
        if (oldPath) {
          const oldFullPath = profile.profile_photo_url.split(`${user.id}/`)[1];
          if (oldFullPath) {
            await supabase.storage.from("profile-photos").remove([filePath]);
          }
        }
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, photoFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
      const photoUrl = data.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_photo_url: photoUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Photo de profil mise à jour avec succès");
      setPhotoFile(null);
      fetchProfileData();
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error(error.message || "Erreur lors de l'upload de la photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer votre photo de profil ?")) {
      return;
    }

    if (!user) return;

    try {
      // Delete from storage
      if (profile?.profile_photo_url) {
        const urlParts = profile.profile_photo_url.split(`${user.id}/`);
        if (urlParts.length > 1) {
          const filePath = `${user.id}/${urlParts[1]}`;
          await supabase.storage.from("profile-photos").remove([filePath]);
        }
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({ profile_photo_url: null })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Photo de profil supprimée");
      setPhotoPreview("");
      setPhotoFile(null);
      fetchProfileData();
    } catch (error: any) {
      console.error("Error deleting photo:", error);
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

  const { filiere, niveau } = membre ? extractFiliereNiveau(membre.filiere) : { filiere: "-", niveau: "-" };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              Mon profil personnel
            </div>
            <h1 className="text-3xl font-bold text-foreground">Mon Profil</h1>
            <p className="text-muted-foreground">
              Consultez vos informations personnelles et votre activité
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Carte principale profil */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={photoPreview || profile?.profile_photo_url || ""} />
                      <AvatarFallback className="text-2xl">
                        {profile?.prenom?.charAt(0) || ""}
                        {profile?.nom?.charAt(0) || ""}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="photo-upload"
                      className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                      title="Changer la photo"
                    >
                      <Upload className="h-4 w-4" />
                      <Input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl">
                      {profile?.prenom || ""} {profile?.nom || ""}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4" />
                      {profile?.email || user?.email}
                    </CardDescription>
                  </div>
                  <div>{getRoleBadge(role)}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Separator />

                {/* Upload photo section */}
                {photoFile && (
                  <div className="space-y-2 p-4 border rounded-lg bg-secondary/50">
                    <Label>Nouvelle photo sélectionnée</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {photoFile.name}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleUploadPhoto}
                            disabled={isUploadingPhoto}
                            className="gap-2"
                          >
                            <Upload className="h-3 w-3" />
                            {isUploadingPhoto ? "Upload en cours..." : "Télécharger"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoPreview(profile?.profile_photo_url || "");
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(profile?.profile_photo_url || photoPreview) && !photoFile && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeletePhoto}
                      className="gap-2 text-destructive"
                    >
                      <X className="h-3 w-3" />
                      Supprimer la photo
                    </Button>
                  </div>
                )}

                {/* Informations personnelles */}
                <div>
                  <h3 className="font-semibold mb-4">Informations personnelles</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Nom</p>
                      <p className="font-medium">{profile?.nom || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Prénom</p>
                      <p className="font-medium">{profile?.prenom || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{profile?.email || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Date d'inscription</p>
                      <p className="font-medium">
                        {profile?.created_at
                          ? new Date(profile.created_at).toLocaleDateString("fr-FR")
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informations membre si disponible */}
                {membre && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-4">Informations membre</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Identifiant</p>
                          <p className="font-medium">{membre.identifiant}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Filière</p>
                          <p className="font-medium">{filiere}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Niveau</p>
                          <p className="font-medium">{niveau}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Numéro de dossier</p>
                          <p className="font-medium">{membre.numero_dossier}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">INE</p>
                          <p className="font-medium font-mono">{membre.ine}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Date de naissance</p>
                          <p className="font-medium">
                            {new Date(membre.date_naissance).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Statistiques */}
            <Card>
              <CardHeader>
                <CardTitle>Mes statistiques</CardTitle>
                <CardDescription>Votre activité dans le système</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Transactions créées</span>
                    <span className="font-bold">{stats.transactionsCreees}</span>
                  </div>
                  <Separator />
                </div>
                {role === "tresorier" && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-success" />
                          Total entrées
                        </span>
                        <span className="font-bold text-success">
                          {formatCurrency(stats.totalEntrees)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" />
                          Total sorties
                        </span>
                        <span className="font-bold text-destructive">
                          {formatCurrency(stats.totalSorties)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transactions récentes */}
          {userTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mes transactions récentes</CardTitle>
                <CardDescription>
                  Les transactions que vous avez créées ou approuvées
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{transaction.libelle}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.categorie} •{" "}
                          {new Date(transaction.date_transaction).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            transaction.type === "entree" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {transaction.type === "entree" ? "+" : "-"}
                          {formatCurrency(Number(transaction.montant))}
                        </p>
                        <Badge
                          variant={
                            transaction.statut === "approuve"
                              ? "default"
                              : transaction.statut === "en_attente"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {transaction.statut.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default Profil;

