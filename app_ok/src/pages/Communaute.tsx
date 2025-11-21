import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, Trash2, Edit, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { Tables } from "@/integrations/supabase/types";

type CommunityMessage = Tables<"community_messages"> & {
  profiles?: {
    nom: string | null;
    prenom: string | null;
    email: string;
    profile_photo_url: string | null;
  };
  membres?: {
    identifiant: string;
    filiere: string;
    nom: string;
    prenom: string;
  } | null;
};

const ANNEE_PREPARATOIRE = "ANNEE PREPARATOIRE";

const extractFiliereNiveau = (combined?: string | null) => {
  if (!combined) return { filiere: "-", niveau: "-" };
  const upperCombined = combined.toUpperCase();
  if (upperCombined.includes("ANNEE PREPARATOIRE") || upperCombined.includes("ANNÉE PRÉPARATOIRE")) {
    return { filiere: "ANNEE PREPARATOIRE", niveau: "-" };
  }
  const parts = combined.split(" - ");
  return {
    filiere: parts[0] || "-",
    niveau: parts[1] || "-",
  };
};

const Communaute = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageContent, setMessageContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMessage, setEditingMessage] = useState<CommunityMessage | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    fetchMessages();
    // Subscribe to new messages
    const channel = supabase
      .channel("community_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_messages",
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("community_messages")
        .select(`
          *,
          profiles:user_id (
            nom,
            prenom,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch membres and profile photos for each user
      const messagesWithMembres = await Promise.all(
        (data || []).map(async (message) => {
          const { data: membre } = await supabase
            .from("membres")
            .select("identifiant, filiere, nom, prenom")
            .eq("user_id", message.user_id)
            .single();

          return {
            ...message,
            membres: membre || null,
          };
        })
      );

      setMessages(messagesWithMembres);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Erreur lors du chargement des messages");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    if (!messageContent.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("community_messages")
        .insert({
          user_id: user.id,
          content: messageContent.trim(),
        });

      if (error) throw error;

      toast.success("Message publié avec succès");
      setMessageContent("");
      fetchMessages();
    } catch (error: any) {
      console.error("Error posting message:", error);
      toast.error(error.message || "Erreur lors de la publication du message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingMessage || !editContent.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }

    try {
      const { error } = await supabase
        .from("community_messages")
        .update({ content: editContent.trim() })
        .eq("id", editingMessage.id);

      if (error) throw error;

      toast.success("Message modifié avec succès");
      setIsEditDialogOpen(false);
      setEditingMessage(null);
      setEditContent("");
      fetchMessages();
    } catch (error: any) {
      console.error("Error updating message:", error);
      toast.error(error.message || "Erreur lors de la modification");
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("community_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      toast.success("Message supprimé avec succès");
      fetchMessages();
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const openEditDialog = (message: CommunityMessage) => {
    setEditingMessage(message);
    setEditContent(message.content);
    setIsEditDialogOpen(true);
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
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Espace de discussion communautaire
            </div>
            <h1 className="text-3xl font-bold text-foreground">Communauté</h1>
            <p className="text-muted-foreground">
              Échangez des informations et discutez avec les autres membres
            </p>
          </div>

          {/* Formulaire de message */}
          <Card>
            <CardHeader>
              <CardTitle>Publier un message</CardTitle>
              <CardDescription>
                Partagez vos idées, questions ou informations avec la communauté
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Écrivez votre message ici..."
                  rows={4}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                    <Send className="h-4 w-4" />
                    {isSubmitting ? "Publication..." : "Publier"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Liste des messages */}
          <Card>
            <CardHeader>
              <CardTitle>Messages de la communauté</CardTitle>
              <CardDescription>
                {messages.length} message(s) au total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun message pour le moment. Soyez le premier à publier !
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const profile = message.profiles;
                    const membre = message.membres;
                    const { filiere, niveau } = membre
                      ? extractFiliereNiveau(membre.filiere)
                      : { filiere: "-", niveau: "-" };
                    const displayName = membre
                      ? `${membre.prenom} ${membre.nom}`
                      : profile
                      ? `${profile.prenom || ""} ${profile.nom || ""}`.trim() || profile.email
                      : "Utilisateur";
                    const initials = membre
                      ? `${membre.prenom.charAt(0)}${membre.nom.charAt(0)}`
                      : profile
                      ? `${profile.prenom?.charAt(0) || ""}${profile.nom?.charAt(0) || ""}`
                      : "?";

                    const canEdit = user?.id === message.user_id;
                    const canDelete = canEdit || isAdmin;

                    return (
                      <div key={message.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex gap-4">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={profile?.profile_photo_url || undefined} />
                            <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold">{displayName}</p>
                                  {membre && (
                                    <>
                                      <Badge variant="secondary" className="text-xs">
                                        {filiere}
                                      </Badge>
                                      {niveau !== "-" && (
                                        <Badge variant="outline" className="text-xs">
                                          {niveau}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                  {!membre && (
                                    <Badge variant="outline" className="text-xs">
                                      Non membre
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(message.created_at), "dd MMMM yyyy à HH:mm", {
                                    locale: fr,
                                  })}
                                  {message.updated_at !== message.created_at && (
                                    <span className="ml-1">(modifié)</span>
                                  )}
                                </p>
                              </div>
                              {(canEdit || canDelete) && (
                                <div className="flex gap-2 flex-shrink-0">
                                  {canEdit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditDialog(message)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(message.id)}
                                      className="h-8 w-8 p-0 text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            <Separator className="my-3" />
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le message</DialogTitle>
            <DialogDescription>
              Modifiez le contenu de votre message
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
};

export default Communaute;

