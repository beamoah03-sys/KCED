-- =============================================================================
-- KCED storage buckets
--
-- service-request-images  PRIVATE. Anyone may upload (public form), only staff
--                         may view, through short-lived signed URLs.
-- asset-photos            PRIVATE. Nameplate and asset photos.
-- energy-documents        PRIVATE. Scanned bills, meter-reading photos.
-- avatars                 PUBLIC.  Profile pictures.
--
-- Phase I used a public bucket called "Service Request Images" and stored
-- full public URLs; the web app still displays those legacy URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('service-request-images', 'service-request-images', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('asset-photos', 'asset-photos', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('energy-documents', 'energy-documents', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- service-request-images -------------------------------------------------------
create policy "Public uploads request images"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'service-request-images'
              and (storage.foldername(name))[1] = 'requests');
create policy "Staff view request images"
  on storage.objects for select to authenticated
  using (bucket_id = 'service-request-images' and public.is_active_staff());
create policy "Admins delete request images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'service-request-images' and public.is_admin());

-- asset-photos -------------------------------------------------------------------
create policy "Staff view asset photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'asset-photos' and public.is_active_staff());
create policy "Staff upload asset photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'asset-photos' and public.is_active_staff());
create policy "Managers delete asset photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'asset-photos' and public.current_user_role() in ('admin', 'manager'));

-- energy-documents ---------------------------------------------------------------
create policy "Staff view energy documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'energy-documents' and public.is_active_staff());
create policy "Staff upload energy documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'energy-documents' and public.is_active_staff());
create policy "Managers delete energy documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'energy-documents' and public.current_user_role() in ('admin', 'manager'));

-- avatars: each user writes only inside their own folder <user id>/... ---------------
create policy "Anyone views avatars"
  on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
