-- Promote an existing auth user to the first admin.
--
-- 1. Supabase Dashboard -> Authentication -> Users -> "Add user" -> "Send invitation"
--    (or "Create new user" with a password) for the admin's email.
-- 2. Replace the email below and run this in the SQL editor.
--
-- The SQL editor runs as the service role, so users_guard() allows it.

update public.users
   set role = 'admin',
       status = 'active',
       full_name = coalesce(full_name, 'System Administrator'),
       phone = coalesce(phone, '+233000000000')
 where email = 'admin@knust.edu.gh';   -- <-- change me

select id, email, role, status from public.users where role = 'admin';
