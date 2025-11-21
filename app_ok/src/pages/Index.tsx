import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { 
  Shield, 
  TrendingUp, 
  Users, 
  FileText, 
  CheckCircle2,
  ArrowRight 
} from "lucide-react";

const Index = () => {
  const [appName, setAppName] = useState("SAS Financier");
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);

  useEffect(() => {
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

        setAppName(appNameSetting?.setting_value || "SAS Financier");
        setAppLogoUrl(appLogoSetting?.setting_value || null);
      } catch (error) {
        console.error("Error fetching app settings:", error);
      }
    };

    fetchAppSettings();
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: "Suivi Financier",
      description: "Gestion complète des entrées et sorties avec reçus justificatifs",
    },
    {
      icon: Users,
      title: "Gestion des Membres",
      description: "Profils détaillés et suivi des cotisations pour chaque membre",
    },
    {
      icon: FileText,
      title: "Rapports Automatisés",
      description: "Bilans mensuels et annuels générés automatiquement en PDF",
    },
    {
      icon: Shield,
      title: "Sécurité & Rôles",
      description: "Système de permissions pour Président, Trésorier et Membres",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto mb-16">
          {appLogoUrl ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6 p-2">
              <Avatar className="w-full h-full">
                <AvatarImage src={appLogoUrl} alt={appName} className="object-contain" />
              </Avatar>
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {appName}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Une solution complète et transparente pour le contrôle financier de votre association
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg gap-2">
              <Link to="/auth">
                Commencer
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg">
              <Link to="/dashboard">
                Tableau de bord
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Key Benefits */}
        <Card className="max-w-3xl mx-auto bg-card/80 backdrop-blur">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Fonctionnalités Principales
            </h2>
            <div className="space-y-4">
              {[
                "Enregistrement automatique des entrées (cotisations, dons, sponsoring)",
                "Gestion des dépenses avec justificatifs obligatoires",
                "Système de validation à plusieurs niveaux (Trésorier/Président)",
                "Génération automatique de bilans financiers PDF",
                "Tableaux de bord interactifs en temps réel",
                "Historique complet et transparent de toutes les transactions",
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 bg-card/30 backdrop-blur">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>{appName}</strong> - Contrôle financier transparent et automatisé
            </p>
            <p className="text-xs">
              Développé avec React, TypeScript et Lovable Cloud
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
