-- Create app_settings table for site configuration
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value) VALUES
  ('app_name', 'SAS Financier'),
  ('app_logo_url', '')
ON CONFLICT (setting_key) DO NOTHING;

-- RLS Policies for app_settings
CREATE POLICY "Everyone authenticated can view app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

CREATE POLICY "Admins can delete app settings"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add profile_photo_url to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

