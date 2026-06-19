
-- IDENTITIES
CREATE TABLE public.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nin text,
  id_type text NOT NULL DEFAULT 'NIN',
  date_of_birth date,
  gender text,
  nationality text,
  photo_url text,
  embedding jsonb,
  embeddings_multi jsonb DEFAULT '[]'::jsonb,
  group_tag text NOT NULL DEFAULT 'public',
  notes text,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, nin)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.identities TO authenticated;
GRANT ALL ON public.identities TO service_role;
ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own identities" ON public.identities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX identities_user_idx ON public.identities (user_id);
CREATE INDEX identities_group_idx ON public.identities (user_id, group_tag);

-- DETECTION LOGS
CREATE TABLE public.detection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_id uuid REFERENCES public.identities(id) ON DELETE SET NULL,
  full_name text,
  nin text,
  confidence real,
  camera_id text,
  camera_name text,
  snapshot_url text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  age_estimate int,
  gender text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detection_logs TO authenticated;
GRANT ALL ON public.detection_logs TO service_role;
ALTER TABLE public.detection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs" ON public.detection_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX detection_logs_user_time_idx ON public.detection_logs (user_id, detected_at DESC);
CREATE INDEX detection_logs_identity_idx ON public.detection_logs (identity_id);

-- CAMERAS
CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  rtmp_key text NOT NULL,
  stream_url text,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rtmp_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cameras TO authenticated;
GRANT ALL ON public.cameras TO service_role;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cameras" ON public.cameras FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- realtime for live detections
ALTER PUBLICATION supabase_realtime ADD TABLE public.detection_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras;
