-- FestFlow: User ID authentication foundation
-- Creates a private mapping between usernames and Supabase user accounts.

CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,

    username TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_profiles_username_format
        CHECK (
            username = LOWER(username)
            AND username ~ '^[a-z0-9_]{3,30}$'
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_unique
    ON public.user_profiles (username);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_profiles FROM anon, authenticated;

GRANT ALL ON TABLE public.user_profiles TO service_role;