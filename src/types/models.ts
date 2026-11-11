export type User = {
  id: string;
  apple_sub: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  name_ja: string | null;
  logo_url: string | null;
  accent_color?: string | null;
  hero_image_url?: string | null;
  status?: "live" | "coming_soon" | string;
  series_count?: number;
  figure_count?: number;
  main_figure_count?: number;
};

export type Series = {
  id: string;
  brand_id: string;
  slug: string;
  name_en: string;
  name_ja: string | null;
  product_form: string;
  sort_order: number;
  release_year: number | null;
  cover_image_url: string | null;
  official_url: string | null;
  brand_slug?: string;
  brand_name?: string;
  figure_count?: number;
  secret_count?: number;
};

export type Figure = {
  id: string;
  series_id: string;
  name_en: string;
  name_ja: string | null;
  is_secret: boolean;
  is_limited: boolean;
  is_bonus: boolean;
  is_duo: boolean;
  image_url: string | null;
  sort_order: number;
  series_name?: string;
  series_slug?: string;
  brand_name?: string;
  brand_slug?: string;
};

export type CollectionItem = {
  user_id: string;
  figure_id: string;
  owned_qty: number;
  wishlist: boolean;
  notes: string | null;
  name_en: string;
  name_ja: string | null;
  image_url: string | null;
  is_secret: boolean;
  is_limited: boolean;
  is_bonus: boolean;
  is_duo: boolean;
  series_id: string;
  series_name: string;
  series_slug: string;
  brand_name: string;
};

export type CollectionStats = {
  owned_figures: number;
  owned_qty_total: number;
  wishlist_count: number;
  total_figures: number;
};

export type SeriesProgress = {
  id: string;
  name_en: string;
  slug: string;
  cover_image_url: string | null;
  total: number;
  owned: number;
};
