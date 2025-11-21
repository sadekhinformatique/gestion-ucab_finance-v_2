import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Shield, AlertCircle } from "lucide-react";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast.error("Erreur de connexion", {
        description: error.message === "Invalid login credentials" 
          ? "Email ou mot de passe incorrect"
          : error.message,
      });
    } else {
      toast.success("Connexion réussie!");
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;
    const confirmPassword = formData.get("confirm-password") as string;
    const nom = formData.get("nom") as string;
    const prenom = formData.get("prenom") as string;

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      setIsLoading(false);
      return;
    }

    // Vérifier que l'utilisateur existe dans la table membres
    try {
      // Rechercher un membre avec nom et prénom correspondants et sans compte associé
      const { data: membres, error: membreError } = await supabase
        .from("membres")
        .select("*")
        .ilike("nom", nom.trim())
        .ilike("prenom", prenom.trim());

      if (membreError || !membres || membres.length === 0) {
        toast.error("Inscription non autorisée", {
          description: "Vous devez être ajouté en tant que membre par un administrateur avant de pouvoir créer un compte. Contactez un administrateur.",
        });
        setIsLoading(false);
        return;
      }

      // Trouver un membre sans compte associé ou avec un compte correspondant à cet email
      const membre = membres.find((m) => !m.user_id) || membres[0];


      // Vérifier si l'email correspond (optionnel, ou on peut vérifier d'autres champs)
      // On va permettre l'inscription si le nom et prénom correspondent

      // Vérifier si un compte existe déjà avec cet email ou si le membre a déjà un compte
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .single();

      if (existingProfile) {
        toast.error("Email déjà utilisé", {
          description: "Cet email est déjà associé à un compte. Utilisez la connexion.",
        });
        setIsLoading(false);
        return;
      }

      // Vérifier si ce membre a déjà un compte
      if (membre.user_id) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", membre.user_id)
          .single();

        if (existingUser) {
          toast.error("Compte déjà existant", {
            description: "Ce membre a déjà un compte associé. Contactez un administrateur si vous avez oublié vos identifiants.",
          });
          setIsLoading(false);
          return;
        }
      }

      // Créer le compte
      const { error } = await signUp(email, password, { nom, prenom });

      if (error) {
        toast.error("Erreur d'inscription", {
          description: error.message === "User already registered"
            ? "Cet email est déjà utilisé"
            : error.message,
        });
      } else {
        // Lier le membre au compte utilisateur
        // On va attendre un peu que le trigger crée le profil
        setTimeout(async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("membres")
              .update({ user_id: user.id })
              .eq("id", membre.id);
          }
        }, 2000);

        toast.success("Inscription réussie!", {
          description: "Votre compte a été créé. Vous pouvez maintenant vous connecter.",
        });
      }
    } catch (error: any) {
      console.error("Error during signup:", error);
      toast.error("Erreur lors de la vérification", {
        description: "Une erreur est survenue. Veuillez réessayer ou contacter un administrateur.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            SAS Financier
          </h1>
          <p className="text-muted-foreground">
            Système de gestion financière associative
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
            <CardDescription>
              Connectez-vous ou créez un compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="votre@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Pour créer un compte, vous devez d'abord être ajouté en tant que membre par un administrateur.
                  </AlertDescription>
                </Alert>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom</Label>
                      <Input
                        id="nom"
                        name="nom"
                        type="text"
                        placeholder="Nom"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prenom">Prénom</Label>
                      <Input
                        id="prenom"
                        name="prenom"
                        type="text"
                        placeholder="Prénom"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="signup-email"
                      type="email"
                      placeholder="votre@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      name="signup-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Inscription..." : "S'inscrire"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Compte administrateur par défaut :<br />
          <span className="font-mono text-xs">djahfarsadekh2015@gmail.com</span>
        </p>
      </div>
    </div>
  );
};

export default Auth;
