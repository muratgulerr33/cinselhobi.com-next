import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connection";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Tüm alanlar zorunludur." },
        { status: 400 }
      );
    }

    // Email kontrolü
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılıyor." },
        { status: 400 }
      );
    }

    // Şifreyi Argon2id ile hashle
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    // Kullanıcı oluştur
    const userId = nanoid();
    await db.insert(users).values({
      id: userId,
      name,
      email,
      passwordHash: passwordHash,
    });

    return NextResponse.json(
      { message: "Kayıt başarılı. Giriş yapabilirsiniz." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}

