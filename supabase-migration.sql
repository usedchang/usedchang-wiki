-- ============================================================
-- Supabase 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行本文件全部内容
-- ============================================================

-- 显式事务保证权限、策略或约束任一步失败时整体回滚，避免数据库停在半迁移状态。
BEGIN;

-- 不暴露给 Data API 的内部状态，用于安全相关计数与后续角色拆分。
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.comment_rate_limits (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_comment_at   TIMESTAMPTZ,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_count      INTEGER NOT NULL DEFAULT 0 CHECK (window_count >= 0)
);
REVOKE ALL ON TABLE private.comment_rate_limits FROM PUBLIC, anon, authenticated;

-- 1. 用户资料表（扩展 auth.users）
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE,
  avatar_url TEXT,
  role       TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT profiles_role_allowed CHECK (role IN ('user', 'admin'))
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
  is_deleted BOOLEAN DEFAULT false,
  CONSTRAINT comments_content_length CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000)
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_comments_post_id   ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created   ON public.comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON public.comments(user_id, created_at DESC);

-- 3.5 文章表。正文放在数据库后，发布内容不再依赖某一台浏览器的 localStorage。
CREATE TABLE IF NOT EXISTS public.posts (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  summary      TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL DEFAULT '',
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  kind         TEXT NOT NULL DEFAULT 'solution' CHECK (kind IN ('solution', 'journal', 'knowledge')),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON public.posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_kind_updated ON public.posts(kind, updated_at DESC);

-- 文章类型扩展：兼容已经执行过旧版本迁移的数据库。
-- CREATE TABLE IF NOT EXISTS 不会修改既有 CHECK，因此需要显式替换旧约束。
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- 先处理本迁移脚本自己创建的约束，保证脚本可以安全重复执行。
  ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_kind_allowed;
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.posts'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%kind%'
      AND pg_get_constraintdef(con.oid) ILIKE '%solution%'
      AND pg_get_constraintdef(con.oid) ILIKE '%journal%'
  LOOP
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_kind_allowed
    CHECK (kind IN ('solution', 'journal', 'knowledge')) NOT VALID;
END;
$$;

-- 新写入的评论必须引用真实文章，且父评论必须属于同一文章。
-- NOT VALID 不会因历史孤立数据中断迁移，但会立即约束之后的 INSERT/UPDATE；
-- 清理历史数据后可再执行 VALIDATE CONSTRAINT 完成全量校验。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comments_post_id_fkey'
      AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.posts(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comments_id_post_id_unique'
      AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_id_post_id_unique UNIQUE (id, post_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comments_parent_same_post_fkey'
      AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_parent_same_post_fkey
      FOREIGN KEY (parent_id, post_id) REFERENCES public.comments(id, post_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END;
$$;

-- 防止异常客户端写入超大文章拖垮查询和 Markdown 渲染。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_content_limits'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_content_limits CHECK (
        char_length(title) <= 200
        AND char_length(summary) <= 1000
        AND char_length(content) <= 1000000
        AND jsonb_typeof(tags) = 'array'
        AND jsonb_array_length(tags) <= 30
        AND pg_column_size(tags) <= 8192
      ) NOT VALID;
  END IF;
END;
$$;

-- 3.6 供 RLS、Storage policy 和前端权限展示共用的管理员判断函数。
-- 保留 UUID 参数是为了兼容已部署的函数签名，但始终只检查当前 JWT 用户，
-- 防止客户端传入其他用户 UUID 探测其角色。
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND check_user_id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated;

-- 评论删除统一走受保护 RPC：保留线程节点、清除原正文和作者身份，
-- 防止客户端硬删除父评论时级联删除其他用户的回复。
CREATE OR REPLACE FUNCTION public.soft_delete_comment(target_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '请先登录'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.comments
  SET
    content = '[该评论已删除]',
    user_id = NULL,
    is_deleted = true
  WHERE id = target_comment_id
    AND (user_id = auth.uid() OR public.is_admin());

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RAISE EXCEPTION '评论不存在或无权删除'
      USING ERRCODE = '42501';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_comment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_comment(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 回复必须引用同一篇文章下尚未删除的父评论。
-- 使用触发器而不是仅靠前端，避免直接调用 REST API 伪造跨文章回复。
CREATE OR REPLACE FUNCTION public.validate_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ancestor_depth INTEGER;
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.comments AS parent
    WHERE parent.id = NEW.parent_id
      AND parent.post_id = NEW.post_id
      AND parent.is_deleted = false
  ) THEN
    RAISE EXCEPTION '父评论不存在、已删除或不属于同一篇文章'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    WITH RECURSIVE ancestors AS (
      SELECT parent.id, parent.parent_id, 1 AS depth
      FROM public.comments AS parent
      WHERE parent.id = NEW.parent_id

      UNION ALL

      SELECT parent.id, parent.parent_id, ancestors.depth + 1
      FROM public.comments AS parent
      JOIN ancestors ON parent.id = ancestors.parent_id
      WHERE ancestors.depth < 4
    )
    SELECT COALESCE(max(depth), 0)
    INTO ancestor_depth
    FROM ancestors;

    IF ancestor_depth >= 4 THEN
      RAISE EXCEPTION '评论回复最多允许 3 层'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_comment_parent() FROM PUBLIC, anon, authenticated;

-- 防止已登录账号用脚本快速灌入评论。私有计数行上的 FOR UPDATE 锁让同一用户
-- 的并发请求串行检查；计数不依赖 comments.user_id，因此软删除也不能重置额度。
CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_time TIMESTAMPTZ := clock_timestamp();
  rate_state private.comment_rate_limits%ROWTYPE;
BEGIN
  -- service_role / 后台维护没有 auth.uid()；管理员审核场景也不受普通用户限流影响。
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '评论用户身份不匹配'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO private.comment_rate_limits (
    user_id,
    last_comment_at,
    window_started_at,
    window_count
  )
  VALUES (NEW.user_id, NULL, current_time, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO rate_state
  FROM private.comment_rate_limits
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  IF rate_state.last_comment_at IS NOT NULL
    AND rate_state.last_comment_at > current_time - interval '5 seconds' THEN
    RAISE EXCEPTION '评论过于频繁，请稍后再试'
      USING ERRCODE = 'P0001';
  END IF;

  IF rate_state.window_started_at <= current_time - interval '1 hour' THEN
    rate_state.window_started_at := current_time;
    rate_state.window_count := 0;
  END IF;

  IF rate_state.window_count >= 60 THEN
    RAISE EXCEPTION '本小时评论次数已达上限，请稍后再试'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE private.comment_rate_limits
  SET
    last_comment_at = current_time,
    window_started_at = rate_state.window_started_at,
    window_count = rate_state.window_count + 1
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_comment_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comments_set_updated_at ON public.comments;
CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comments_validate_parent ON public.comments;
CREATE TRIGGER comments_validate_parent
  BEFORE INSERT OR UPDATE OF parent_id, post_id ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_comment_parent();

DROP TRIGGER IF EXISTS comments_rate_limit ON public.comments;
CREATE TRIGGER comments_rate_limit
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_rate_limit();

-- 4. 自动创建 profile（用户注册时触发）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_name TEXT;
  final_name TEXT;
  counter INT := 0;
BEGIN
  -- 优先取用户自定义 username，否则生成随机默认名（避免泄露邮箱前缀）
  base_name := left(COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'username'), ''),
    'user_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  ), 32);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 为迁移前已经存在的账号补齐 profile，否则评论的 user_id 外键会插入失败。
INSERT INTO public.profiles (id, username)
SELECT
  u.id,
  'user_' || replace(u.id::text, '-', '')
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 收紧旧表中可能遗留的空值；UUID 派生名保证唯一且不泄露邮箱。
UPDATE public.profiles
SET username = 'user_' || replace(id::text, '-', '')
WHERE username IS NULL OR btrim(username) = '';

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_allowed'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_allowed
      CHECK (role IN ('user', 'admin'))
      NOT VALID;
  END IF;
END;
$$;

UPDATE public.comments
SET is_deleted = false
WHERE is_deleted IS NULL;

UPDATE public.comments
SET content = '(无内容)'
WHERE content IS NULL OR btrim(content) = '';

-- 旧版本已软删除的正文也必须脱敏，之后这些节点会作为墓碑公开以维持回复树。
UPDATE public.comments
SET
  content = '[该评论已删除]',
  user_id = NULL
WHERE is_deleted = true;

ALTER TABLE public.comments ALTER COLUMN is_deleted SET DEFAULT false;
ALTER TABLE public.comments ALTER COLUMN is_deleted SET NOT NULL;
ALTER TABLE public.comments ALTER COLUMN content SET NOT NULL;

-- CREATE TABLE IF NOT EXISTS 不会给旧表补约束，因此在清理旧空值后单独添加。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_content_length'
      AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_content_length
      CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000)
      NOT VALID;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_username_length'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_length
      CHECK (char_length(btrim(username)) BETWEEN 1 AND 40)
      NOT VALID;
  END IF;
END;
$$;

-- 5. Row-Level Security 策略

-- 已发布文章的评论节点公开可读；软删除节点只暴露脱敏墓碑，以维持回复树。
-- 管理员还可读取未发布文章及旧孤立评论，用于审核和清理。
DROP POLICY IF EXISTS "comments_read" ON public.comments;
DROP POLICY IF EXISTS "comments_read_visible_or_admin" ON public.comments;
CREATE POLICY "comments_read_visible_or_admin" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.posts AS comment_post
      WHERE comment_post.id = comments.post_id
        AND comment_post.status = 'published'
    )
  );

-- 只允许以自己的身份评论真实、已发布的文章。
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_on_published_post" ON public.comments;
CREATE POLICY "comments_insert_on_published_post" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts AS target_post
      WHERE target_post.id = comments.post_id
        AND target_post.status = 'published'
    )
  );

-- 浏览器不能直接 UPDATE；原作者和管理员只能调用 soft_delete_comment()。
DROP POLICY IF EXISTS "comments_update" ON public.comments;
DROP POLICY IF EXISTS "comments_update_owner_or_admin" ON public.comments;

-- 禁止浏览器客户端硬删除评论，避免父评论级联删除其他用户的回复。
DROP POLICY IF EXISTS "comments_delete" ON public.comments;

-- 公开可读 profile（anon key 本身公开，用于评论展示作者名）
-- 注意：username 已在 handle_new_user 中改为随机生成，不泄露邮箱
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

-- 行级策略只允许修改本人；列级 GRANT 会进一步禁止修改 role/id。
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 先撤销 Supabase 旧项目可能自动授予的默认权限，再按最小权限重新授予。
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.posts FROM PUBLIC, anon, authenticated;

-- REVOKE TABLE 不一定清除历史列级授权；显式清空全部列权限后再最小化授予。
REVOKE ALL PRIVILEGES (id, username, avatar_url, role, created_at)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES (id, post_id, user_id, content, parent_id, created_at, updated_at, is_deleted)
  ON TABLE public.comments FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES (
  id, title, summary, content, tags, kind, status, author_id, created_at, updated_at, published_at
)
  ON TABLE public.posts FROM PUBLIC, anon, authenticated;

-- role 不授予浏览器读取或更新权限；管理员状态通过 is_admin() 获取。
GRANT SELECT (id, username, avatar_url, created_at)
  ON public.profiles TO anon, authenticated;
GRANT UPDATE (username, avatar_url)
  ON public.profiles TO authenticated;

GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT (post_id, user_id, content, parent_id)
  ON public.comments TO authenticated;

GRANT SELECT (
  id, title, summary, content, tags, kind, status, created_at, updated_at, published_at
) ON public.posts TO anon, authenticated;
GRANT INSERT (
  id, title, summary, content, tags, kind, status, author_id,
  created_at, updated_at, published_at
) ON public.posts TO authenticated;
GRANT UPDATE (
  title, summary, content, tags, kind, status, published_at
) ON public.posts TO authenticated;
GRANT DELETE ON public.posts TO authenticated;

-- 允许访客读取已发布文章，管理员可读写草稿。
DROP POLICY IF EXISTS "posts_read" ON public.posts;
CREATE POLICY "posts_read" ON public.posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "posts_insert_admin" ON public.posts;
CREATE POLICY "posts_insert_admin" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND (author_id IS NULL OR author_id = auth.uid()));

DROP POLICY IF EXISTS "posts_update_admin" ON public.posts;
CREATE POLICY "posts_update_admin" ON public.posts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "posts_delete_admin" ON public.posts;
CREATE POLICY "posts_delete_admin" ON public.posts
  FOR DELETE TO authenticated USING (public.is_admin());

-- 文章图片使用公开 bucket，写入仍限管理员。
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "post_images_public_read" ON storage.objects;
CREATE POLICY "post_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');
DROP POLICY IF EXISTS "post_images_admin_insert" ON storage.objects;
CREATE POLICY "post_images_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-images' AND public.is_admin());
DROP POLICY IF EXISTS "post_images_admin_update" ON storage.objects;
CREATE POLICY "post_images_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'post-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'post-images' AND public.is_admin());
DROP POLICY IF EXISTS "post_images_admin_delete" ON storage.objects;
CREATE POLICY "post_images_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'post-images' AND public.is_admin());

-- 7. 开启 Realtime（评论表变更实时推送）。
-- 使用 DO + pg_publication_tables，脚本可重复执行而不会因“已存在”失败。
ALTER TABLE public.comments REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;
END;
$$;

COMMIT;
