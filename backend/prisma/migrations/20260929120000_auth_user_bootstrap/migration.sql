CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Auth user email is required for application account bootstrap'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.app_users (user_id, email, role, status)
  VALUES (NEW.id, NEW.email, 'BUYER', 'ACTIVE')
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER auth_user_bootstrap
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

INSERT INTO public.app_users (user_id, email, role, status)
SELECT users.id, users.email, 'BUYER', 'ACTIVE'
FROM auth.users AS users
WHERE users.email IS NOT NULL
  AND btrim(users.email) <> ''
ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = now();

DO $backfill_validation$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users AS users
    LEFT JOIN public.app_users AS app_user ON app_user.user_id = users.id
    WHERE (users.email IS NULL OR btrim(users.email) = '')
      AND app_user.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing Auth users without email cannot be bootstrapped';
  END IF;
END;
$backfill_validation$;
