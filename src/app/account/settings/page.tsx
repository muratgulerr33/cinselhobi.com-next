import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground">
          Profil bilgilerinizi ve uygulama tercihlerinizi yönetin.
        </p>
      </div>

      <Separator />

      {/* Profil Bölümü */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Profil Bilgileri</h2>
          <p className="text-sm text-muted-foreground">
            Adınız ve kişisel bilgileriniz.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ProfileForm defaultName={session.user.name || ""} />
          </CardContent>
        </Card>
      </section>

      {/* Şifre Bölümü */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Güvenlik</h2>
          <p className="text-sm text-muted-foreground">
            Şifrenizi buradan değiştirebilirsiniz.
          </p>
        </div>
        
        <Card>
           <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="password-change" className="border-b-0">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 rounded-t-lg">
                <span className="font-medium">Şifre Değiştir</span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2">
                <PasswordForm />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </section>

      {/* Görünüm Bölümü */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Görünüm</h2>
          <p className="text-sm text-muted-foreground">
            Uygulama temasını özelleştirin.
          </p>
        </div>
        <Card>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>
      </section>

      {/* Oturum Bölümü (Çıkış) */}
      <section className="space-y-4 pb-10">
        <div>
          <h2 className="text-lg font-medium text-destructive">Oturum</h2>
          <p className="text-sm text-muted-foreground">
            Hesabınızdan güvenli bir şekilde çıkış yapın.
          </p>
        </div>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-destructive">
                Oturumu Sonlandır
              </span>
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
