-- ============================================================
-- Supabase 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行本文件全部内容
-- ============================================================

-- 1. 用户资料表（扩展 auth.users）
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE,
  avatar_url TEXT,
  role       TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 评论表
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    TEXT NOT NULL,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  parent_id  UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_comments_post_id   ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created   ON public.comments(created_at DESC);

-- 4. 自动创建 profile（用户注册时触发）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_name TEXT;
  final_name TEXT;
  counter INT := 0;
BEGIN
  -- 优先取用户自定义 username，否则生成随机默认名（避免泄露邮箱前缀）
  base_name := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    'user_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  );

  final_name := base_name;

  -- 重名时追加后缀，最多重试 10 次避免死循环
  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (NEW.id, final_name);
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        counter := counter + 1;
        IF counter > 10 THEN
          RAISE EXCEPTION '无法为用户 % 生成唯一用户名（已重试 % 次）', NEW.id, counter;
        END IF;
        final_name := base_name || '_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Row-Level Security 策略

-- 允许已认证用户读取未删除的评论
DROP POLICY IF EXISTS "comments_read" ON public.comments;
CREATE POLICY "comments_read" ON public.comments
  FOR SELECT USING (is_deleted = false);

-- 允许已认证用户发表评论（只能以自己身份）
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 允许用户编辑/软删除自己的评论
DROP POLICY IF EXISTS "comments_update" ON public.comments;
CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

-- 允许用户删除自己的评论
DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- 公开可读 profile（anon key 本身公开，用于评论展示作者名）
-- 注意：username 已在 handle_new_user 中改为随机生成，不泄露邮箱
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles
  FOR SELECT USING (true);

-- 只能修改自己的 profile
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 7. 开启 Realtime（评论表变更实时推送）
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
