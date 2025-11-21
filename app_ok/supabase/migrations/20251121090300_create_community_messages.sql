-- Create community_messages table for discussion forum
CREATE TABLE public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Index for better query performance
CREATE INDEX idx_community_messages_created_at ON public.community_messages(created_at DESC);
CREATE INDEX idx_community_messages_user_id ON public.community_messages(user_id);

-- RLS Policies for community_messages
CREATE POLICY "Everyone authenticated can view messages"
  ON public.community_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Everyone authenticated can create messages"
  ON public.community_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.community_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.community_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any message"
  ON public.community_messages FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'president') OR
    public.has_role(auth.uid(), 'tresorier')
  );

-- Trigger for updated_at
CREATE TRIGGER update_community_messages_updated_at
  BEFORE UPDATE ON public.community_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

