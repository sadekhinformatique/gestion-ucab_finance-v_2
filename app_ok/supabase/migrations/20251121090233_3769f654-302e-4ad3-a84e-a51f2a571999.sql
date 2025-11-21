-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('president', 'tresorier', 'membre');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nom TEXT,
  prenom TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create membres table
CREATE TABLE public.membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  identifiant TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  filiere TEXT NOT NULL,
  sexe TEXT NOT NULL CHECK (sexe IN ('M', 'F')),
  numero_dossier TEXT NOT NULL UNIQUE,
  ine TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.membres ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  categorie TEXT NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  libelle TEXT NOT NULL,
  date_transaction DATE NOT NULL DEFAULT CURRENT_DATE,
  matricule TEXT,
  numero_recu TEXT,
  responsable_fonction TEXT,
  created_by UUID REFERENCES auth.users(id),
  approuve_par UUID REFERENCES auth.users(id),
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'rejete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nom',
    NEW.raw_user_meta_data->>'prenom'
  );
  
  -- Assign default role as 'membre'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'membre');
  
  RETURN NEW;
END;
$$;

-- Trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_membres_updated_at
  BEFORE UPDATE ON public.membres
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

-- RLS Policies for membres
CREATE POLICY "Everyone authenticated can view membres"
  ON public.membres FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert membres"
  ON public.membres FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

CREATE POLICY "Admins can update membres"
  ON public.membres FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

CREATE POLICY "Admins can delete membres"
  ON public.membres FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

-- RLS Policies for transactions
CREATE POLICY "Everyone authenticated can view transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Tresorier can insert transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'tresorier'));

CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

CREATE POLICY "Admins can delete transactions"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

-- RLS Policies for receipts
CREATE POLICY "Everyone authenticated can view receipts"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Tresorier can insert receipts"
  ON public.receipts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'tresorier'));

CREATE POLICY "Admins can delete receipts"
  ON public.receipts FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );