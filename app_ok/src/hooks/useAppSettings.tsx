import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAppSettings = () => {
  const [appName, setAppName] = useState("SAS Financier");
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppSettings();

    // Subscribe to changes
    const channel = supabase
      .channel("app_settings_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
        },
        () => {
          fetchAppSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAppSettings = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  return { appName, appLogoUrl, loading };
};

