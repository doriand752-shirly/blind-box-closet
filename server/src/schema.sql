CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ja TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  product_form TEXT NOT NULL DEFAULT 'blind_box_mini',
  sort_order INT NOT NULL DEFAULT 0,
  release_year INT,
  cover_image_url TEXT,
  official_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, slug)
);

CREATE TABLE IF NOT EXISTS figures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  is_limited BOOLEAN NOT NULL DEFAULT false,
  is_bonus BOOLEAN NOT NULL DEFAULT false,
  is_duo BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS figures_series_idx ON figures(series_id);
CREATE INDEX IF NOT EXISTS series_brand_idx ON series(brand_id);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apple_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_figures (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  figure_id UUID NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
  owned_qty INT NOT NULL DEFAULT 0,
  wishlist BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, figure_id)
);

CREATE INDEX IF NOT EXISTS user_figures_user_idx ON user_figures(user_id);
