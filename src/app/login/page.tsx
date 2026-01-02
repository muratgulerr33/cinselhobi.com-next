"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailExistsAction } from "@/actions/auth";
import { getFavoriteIntent } from "@/lib/favorites-intent";
import { toast } from "sonner";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // callbackUrl kaynağı: searchParams > intent > default
  const callbackUrlFromSearch = searchParams.get("callbackUrl");
  const intent = getFavoriteIntent();
  const callbackUrl = callbackUrlFromSearch || intent?.from || "/";

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      return;
    }

    setIsCheckingEmail(true);
    try {
      const result = await emailExistsAction(email);
      if (!result.ok) {
        toast.error(result.error || "Bir hata oluştu");
        return;
      }
      setEmailExists(result.exists);
      setEmailSubmitted(true);
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleOAuthSignIn = async (providerId: string) => {
    try {
      const result = await signIn(providerId, {
        redirect: false,
        callbackUrl,
      });

      if (result?.url) {
        router.push(result.url);
      } else {
        toast.error(`${providerId === "google" ? "Google" : "Facebook"} girişi şu an aktif değil.`);
      }
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  // Email-first akış: email henüz submit edilmediyse email input göster
  if (!emailSubmitted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6">Giriş Yap</h1>

        {/* OAuth Butonları */}
        <div className="space-y-3 mb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthSignIn("google")}
          >
            Google ile devam et
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthSignIn("facebook")}
          >
            Facebook ile devam et
          </Button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">veya</span>
          </div>
        </div>

        {/* Email Input */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              E-posta ile devam et
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta adresiniz"
              required
              disabled={isCheckingEmail}
            />
          </div>
          <Button type="submit" disabled={isCheckingEmail} className="w-full">
            {isCheckingEmail ? "Kontrol ediliyor..." : "Devam Et"}
          </Button>
        </form>
      </div>
    );
  }

  // Email submit edildi: exists=true ise LoginForm, exists=false ise SignupForm
  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-6">
        {emailExists ? "Giriş Yap" : "Kayıt Ol"}
      </h1>
      {emailExists ? (
        <LoginForm defaultEmail={email} callbackUrl={callbackUrl} />
      ) : (
        <SignupForm defaultEmail={email} callbackUrl={callbackUrl} />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6">Giriş Yap</h1>
        <div>Yükleniyor...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

