# Auth.js v5 Kurulum Dokümantasyonu

## Güvenlik Notları

### Environment Variables
- `AUTH_SECRET`: Production ortamında mutlaka ayarlanmalıdır
- `AUTH_URL`: Production ortamında base URL olarak ayarlanmalıdır
- Secret üretmek için: `openssl rand -base64 32` veya `npx auth secret`

### Password Hashing
- Şifreler `bcryptjs` ile hashlenmektedir
- Salt rounds: 10 (production için yeterli)

### CSRF Koruması
- Auth.js v5 otomatik olarak CSRF koruması sağlar
- Middleware'de `auth()` fonksiyonu kullanılarak koruma aktif edilir

### Rate Limiting
- Production ortamında rate limiting eklenmelidir
- Önerilen: `@upstash/ratelimit` veya benzeri bir çözüm

### Session Yönetimi
- JWT stratejisi kullanılmaktadır
- Session süresi varsayılan olarak 30 gündür
- Production'da session süresi ayarlanabilir

## Kullanım

### Server Component'lerde
```typescript
import { auth } from "@/auth";

export default async function Page() {
  const session = await auth();
  
  if (!session) {
    return <div>Giriş yapmalısınız</div>;
  }
  
  return <div>Hoş geldiniz, {session.user.name}</div>;
}
```

### Client Component'lerde
```typescript
"use client";

import { useAuth } from "@/hooks/use-auth";

export default function Component() {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) return <div>Yükleniyor...</div>;
  if (!isAuthenticated) return <div>Giriş yapmalısınız</div>;
  
  return <div>Hoş geldiniz, {user?.name}</div>;
}
```

### Sign In/Out
```typescript
"use client";

import { signIn, signOut } from "next-auth/react";

// Giriş
await signIn("credentials", {
  email: "user@example.com",
  password: "password",
  redirect: true,
});

// Çıkış
await signOut({ redirect: true });
```

## Protected Routes

Middleware'de protected route'lar tanımlanabilir:

```typescript
// src/middleware.ts
if (pathname.startsWith("/account") && !req.auth) {
  return NextResponse.redirect(new URL("/login", req.url));
}
```

## Migration

Auth tablolarını oluşturmak için:

```bash
npm run db:generate
npm run db:migrate
```

## Provider Ekleme

Yeni bir provider eklemek için `src/auth.ts` dosyasındaki `providers` array'ine ekleyin:

```typescript
import Google from "next-auth/providers/google";

providers: [
  // ... mevcut provider'lar
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
],
```

