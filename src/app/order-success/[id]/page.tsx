import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOrderById } from "@/db/queries/order";
import { OrderSuccessClearCart } from "@/components/order/order-success-clear-cart";

interface OrderSuccessPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderSuccessPage({ params }: OrderSuccessPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Siparişin kullanıcıya ait olduğunu kontrol et
  const order = await getOrderById(id, session.user.id);

  if (!order) {
    redirect("/account");
  }

  return (
    <>
      <OrderSuccessClearCart />
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Siparişiniz Alındı!</h1>
          <p className="text-muted-foreground mb-6">
            Siparişiniz başarıyla oluşturuldu. En kısa sürede hazırlanacak ve size ulaştırılacaktır.
          </p>
          
          <div className="bg-background rounded-xl p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Sipariş Numarası</p>
            <p className="text-lg font-mono font-semibold">{id}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/account">
              <Button className="w-full sm:w-auto">Hesabıma Git</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto">
                Alışverişe Devam Et</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

