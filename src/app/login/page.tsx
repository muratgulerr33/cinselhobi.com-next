"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Roboto } from "next/font/google";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailExistsAction } from "@/actions/auth";
import { getFavoriteIntent } from "@/lib/favorites-intent";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const robotoMedium = Roboto({ subsets: ["latin", "latin-ext"], weight: "500" });

// Google Icon Component
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Facebook Icon Component
function FacebookIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="white"
      />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

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
      setOauthLoading(providerId as "google" | "facebook");
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
    } finally {
      setOauthLoading(null);
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
            className="h-12 w-full rounded-xl flex items-center gap-3 px-4 bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-100 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black/0 focus-visible:ring-primary disabled:opacity-50 shadow-sm"
            onClick={() => handleOAuthSignIn("google")}
            disabled={oauthLoading !== null}
          >
            {oauthLoading === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span className={cn("flex-1 text-center !font-[500]", robotoMedium.className)}>Google ile devam et</span>
            <span className="w-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl flex items-center gap-3 px-4 font-medium bg-[#1877F2] text-white hover:bg-[#166FE5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black/0 focus-visible:ring-primary disabled:opacity-50"
            onClick={() => handleOAuthSignIn("facebook")}
            disabled={oauthLoading !== null}
          >
            {oauthLoading === "facebook" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FacebookIcon />
            )}
            <span className="flex-1 text-center">Facebook ile devam et</span>
            <span className="w-5" aria-hidden />
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
