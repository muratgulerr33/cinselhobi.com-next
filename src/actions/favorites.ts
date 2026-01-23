"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { toggleFavorite, listFavoritesByUserId, isFavorite, listFavoriteProductIdsByUserId } from "@/db/queries/favorites";
import { z } from "zod";

const productIdSchema = z.number().int().positive();

export async function toggleFavoriteAction(productId: number) {
  const validationResult = productIdSchema.safeParse(productId);
  if (!validationResult.success) {
    return { ok: false, error: "Invalid input" as const, isFavorite: false };
  }
  
  const session = await auth();
  
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const, isFavorite: false };
  }

  const userId = session.user.id;

  try {
    // Toggle işlemini yap - dönen değer: true = eklendi (artık favori), false = silindi (artık favori değil)
    const isFavorite = await toggleFavorite(userId, validationResult.data);
    
    // Boolean in -> Boolean out: toggleFavorite'ın döndürdüğü değer kesinlikle gerçek durumu yansıtıyor
    // true = eklendi (artık favori) -> isFavorite = true
    // false = silindi (artık favori değil) -> isFavorite = false
    
    // Cache'i yenile - favoriler sayfası ve ürün detay sayfası güncellensin
    revalidatePath("/", "layout");
    revalidatePath("/account", "layout");
    revalidatePath("/account/wishlist");
    revalidatePath("/urun/[slug]", "page");
    
    return { ok: true, isFavorite };
  } catch (error) {
    console.error("[toggleFavoriteAction] Hata:", error);
    return { ok: false, error: "Failed to toggle favorite", isFavorite: false };
  }
}

export async function getMyFavoritesAction() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized", favorites: [] };
  }

  try {
    const favorites = await listFavoritesByUserId(session.user.id);
    return { ok: true, favorites };
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return { ok: false, error: "Failed to fetch favorites", favorites: [] };
  }
}

export async function checkIsFavoriteAction(productId: number) {
  const validationResult = productIdSchema.safeParse(productId);
  if (!validationResult.success) {
    return { ok: false, isFavorite: false };
  }

  const session = await auth();
  
  if (!session?.user?.id) {
    return { ok: false, isFavorite: false };
  }

  try {
    const favorite = await isFavorite(session.user.id, validationResult.data);
    return { ok: true, isFavorite: favorite };
  } catch (error) {
    console.error("Error checking favorite:", error);
    return { ok: false, isFavorite: false };
  }
}

export async function getMyFavoriteProductIdsAction() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { ok: true, productIds: [] };
  }

  try {
    const productIds = await listFavoriteProductIdsByUserId(session.user.id);
    return { ok: true, productIds };
  } catch (error) {
    console.error("Error fetching favorite product IDs:", error);
    return { ok: false, error: "Failed to fetch favorite product IDs", productIds: [] };
  }
}

