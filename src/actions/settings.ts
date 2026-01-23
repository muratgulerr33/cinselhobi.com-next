"use server";

import { auth } from "@/auth";
import { db } from "@/db/connection";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hash, verify } from "argon2";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli"),
  newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı"),
  confirmPassword: z.string().min(6, "Şifre tekrarı gerekli"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

export async function updateProfile(data: z.infer<typeof profileSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Oturum açmanız gerekiyor." };

  const validated = profileSchema.safeParse(data);
  if (!validated.success) return { error: "Geçersiz veri." };

  try {
    await db
      .update(users)
      .set({ name: validated.data.name })
      .where(eq(users.id, session.user.id));

    revalidatePath("/account/settings");
    return { success: "Profil güncellendi." };
  } catch (error) {
    console.error("Profile update error:", error);
    return { error: "Bir hata oluştu." };
  }
}

export async function updatePassword(data: z.infer<typeof passwordSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Oturum açmanız gerekiyor." };

  const validated = passwordSchema.safeParse(data);
  if (!validated.success) return { error: "Form hatalı." };

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // FIX: password -> passwordHash
    if (!user || !user.passwordHash) return { error: "Kullanıcı bulunamadı." };

    // FIX: password -> passwordHash
    const isValid = await verify(user.passwordHash, validated.data.currentPassword);
    if (!isValid) return { error: "Mevcut şifre yanlış." };

    const newPasswordHash = await hash(validated.data.newPassword);

    await db
      .update(users)
      // FIX: password -> passwordHash
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, session.user.id));

    revalidatePath("/account/settings");
    return { success: "Şifre başarıyla değiştirildi." };
  } catch (error) {
    console.error("Password update error:", error);
    return { error: "Şifre güncellenemedi." };
  }
}
