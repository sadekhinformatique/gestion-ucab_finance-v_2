-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile photos bucket
CREATE POLICY "Authenticated users can upload their own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can view all profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update their own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can delete any profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  )
);

-- Create storage bucket for app logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-logos', 'app-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for app logos bucket
CREATE POLICY "Admins can upload app logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-logos' AND (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  )
);

CREATE POLICY "Everyone can view app logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-logos');

CREATE POLICY "Admins can update app logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-logos' AND (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  )
);

CREATE POLICY "Admins can delete app logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-logos' AND (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  )
);

