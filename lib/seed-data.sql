-- ============================================================
-- Seed: Test Profiles
-- Run AFTER schema.sql. Replace UUIDs with real test account IDs.
-- ============================================================

-- To create test users:
-- 1. Go to Supabase Dashboard → Authentication → Users → Add user
-- 2. Create 3 test users with known emails
-- 3. Get their UUIDs from the dashboard
-- 4. Replace the placeholder UUIDs below

-- Example test user profiles (replace UUIDs with your test user IDs):
insert into public.profiles (id, email, display_name, age, bio, neighborhood, location, distance_preference, gender, gender_preference, is_profile_complete, is_verified, primary_photo_url) values
  ('11111111-1111-1111-1111-111111111111', 'riley@test.com', 'Riley', 28, 'A good first date is somewhere we can split dessert and lose track of time.', 'Silver Lake', 'Los Angeles', 25, 'woman', 'man', true, true, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85'),
  ('22222222-2222-2222-2222-222222222222', 'amara@test.com', 'Amara', 27, 'My ideal kind of spontaneous is picking a direction and finding the best taco on the way.', 'Echo Park', 'Los Angeles', 25, 'man', 'woman', true, false, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=85'),
  ('33333333-3333-3333-3333-333333333333', 'noah@test.com', 'Noah', 30, 'I will always say yes to a bookstore detour, especially if there''s coffee involved.', 'Los Feliz', 'Los Angeles', 25, 'man', 'woman', true, true, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=85');

-- Create mutual likes between test users to see matches:
-- (These assume the profile IDs above exist)
insert into public.swipes (swiper_id, target_id, direction) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'like'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'like');

-- Manual match creation (if the swipe trigger function isn't set up yet):
-- The app's API handles this automatically, but you can pre-seed matches:
-- insert into public.matches (user_a, user_b) values
--   ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- insert into public.conversations (match_id, user_a, user_b) values
--   ((select id from public.matches where user_a = '11111111-1111-1111-1111-111111111111' and user_b = '22222222-2222-2222-2222-222222222222'), '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Make yourself an admin (replace with your actual user ID):
-- insert into public.admin_users (id) values ('<your-user-id>');
