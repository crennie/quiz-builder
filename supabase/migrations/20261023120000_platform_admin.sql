ALTER TABLE public.profiles
    ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_platform_admin IS
    'Platform administration permission; managed directly in the database, never from Auth metadata or API writes.';
