import Constants from "expo-constants";
import type {
  Brand,
  CollectionItem,
  CollectionStats,
  Figure,
  Series,
  SeriesProgress,
  User,
} from "../types/models";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra?.apiUrl ||
  "http://85.17.145.134:8787";

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  formData?: FormData;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  appleAuth: (payload: {
    identityToken: string;
    email?: string | null;
    fullName?: string | null;
  }) =>
    request<{ token: string; user: User }>("/auth/apple", {
      method: "POST",
      body: payload,
    }),

  me: (token: string) => request<{ user: User }>("/me", { token }),

  deleteMe: (token: string) =>
    request<{ ok: boolean }>("/me", { method: "DELETE", token }),

  brands: () => request<{ brands: Brand[] }>("/catalog/brands"),

  series: (params?: { brandId?: string; brandSlug?: string }) => {
    const q = new URLSearchParams();
    if (params?.brandId) q.set("brandId", params.brandId);
    if (params?.brandSlug) q.set("brandSlug", params.brandSlug);
    const qs = q.toString();
    return request<{ series: Series[] }>(`/catalog/series${qs ? `?${qs}` : ""}`);
  },

  seriesDetail: (id: string) =>
    request<{ series: Series; figures: Figure[] }>(`/catalog/series/${id}`),

  figures: (params?: { q?: string; seriesId?: string; secretsOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set("q", params.q);
    if (params?.seriesId) q.set("seriesId", params.seriesId);
    if (params?.secretsOnly) q.set("secretsOnly", "1");
    const qs = q.toString();
    return request<{ figures: Figure[] }>(`/catalog/figures${qs ? `?${qs}` : ""}`);
  },

  collection: (token: string) =>
    request<{
      items: CollectionItem[];
      stats: CollectionStats;
      seriesProgress: SeriesProgress[];
    }>("/me/collection", { token }),

  upsertCollection: (
    token: string,
    body: {
      figureId: string;
      owned_qty?: number;
      wishlist?: boolean;
      notes?: string | null;
    },
  ) =>
    request<{ item?: CollectionItem; deleted?: boolean }>("/me/collection", {
      method: "PUT",
      token,
      body,
    }),

  createBrand: (
    token: string,
    body: { slug: string; name: string; name_ja?: string; logo_url?: string },
  ) =>
    request<{ brand: Brand }>("/admin/brands", { method: "POST", token, body }),

  createSeries: (
    token: string,
    body: {
      brand_id: string;
      slug: string;
      name_en: string;
      name_ja?: string;
      product_form?: string;
      sort_order?: number;
      release_year?: number;
      cover_image_url?: string;
      official_url?: string;
    },
  ) =>
    request<{ series: Series }>("/admin/series", { method: "POST", token, body }),

  updateSeries: (token: string, id: string, body: Partial<Series>) =>
    request<{ series: Series }>(`/admin/series/${id}`, {
      method: "PATCH",
      token,
      body,
    }),

  deleteSeries: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/series/${id}`, { method: "DELETE", token }),

  createFigure: (
    token: string,
    body: {
      series_id: string;
      name_en: string;
      name_ja?: string;
      is_secret?: boolean;
      is_limited?: boolean;
      is_bonus?: boolean;
      is_duo?: boolean;
      image_url?: string;
      sort_order?: number;
    },
  ) =>
    request<{ figure: Figure }>("/admin/figures", { method: "POST", token, body }),

  updateFigure: (token: string, id: string, body: Partial<Figure>) =>
    request<{ figure: Figure }>(`/admin/figures/${id}`, {
      method: "PATCH",
      token,
      body,
    }),

  deleteFigure: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/figures/${id}`, { method: "DELETE", token }),

  upload: async (token: string, uri: string, kind: "figures" | "series" | "brands" = "figures") => {
    const form = new FormData();
    const name = uri.split("/").pop() || "upload.jpg";
    form.append("file", {
      uri,
      name,
      type: "image/jpeg",
    } as any);
    form.append("kind", kind);
    return request<{ url: string }>("/admin/upload", {
      method: "POST",
      token,
      formData: form,
    });
  },
};
