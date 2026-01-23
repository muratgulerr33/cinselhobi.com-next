"use server";

import { db } from "@/db/connection";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
});

type EmailExistsResult =
  | { ok: true; exists: boolean }
  | { ok: false; error: string };

/**
 * Email adresinin kayıtlı olup olmadığını kontrol eder
 * @param email - Kontrol edilecek e-posta adresi
 * @returns { ok: true, exists: boolean } veya { ok: false, error: string }
 */
export async function emailExistsAction(email: string): Promise<EmailExistsResult> {
  try {
    // Email validation
    const validationResult = emailSchema.safeParse({ email });
    if (!validationResult.success) {
      return { ok: false as const, error: "Geçerli bir e-posta adresi giriniz" };
    }

    // DB sorgusu: Email var mı?
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validationResult.data.email))
      .limit(1);

    // Sadece exists boolean döndür (PII yok)
    return { ok: true as const, exists: existingUser.length > 0 };
  } catch (error) {
    // Console log'da email yazdırma (PII riski)
    console.error("[emailExistsAction] Hata:", error);
    return { ok: false as const, error: "Bir hata oluştu. Lütfen tekrar deneyin." };
  }
}

