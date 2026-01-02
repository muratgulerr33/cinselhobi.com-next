import { CreditCard, Building2, RotateCcw, Truck, AlertCircle, Mail } from "lucide-react";
import Link from "next/link";

export default function OdemeVeTeslimatPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold mb-6">Ödeme ve Teslimat</h1>

        <div className="space-y-8">
          {/* 1. Banka Havalesi veya EFT */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                1) Banka Havalesi veya EFT (Elektronik Fon Transferi)
              </h2>
            </div>
            <p className="text-sm leading-6 text-foreground/90">
              AKBANK AŞ. Hesabına (TL) yapabilirsiniz
            </p>
          </section>

          {/* 2. Kredi Kartı */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                2) Sitemiz üzerinden kredi kartlarınız ile
              </h2>
            </div>
            <p className="text-sm leading-6 text-foreground/90">
              Her türlü kredi kartınıza online tek ödeme ya da anlaşmalı bankalarımız ile online taksit imkânlarımızdan yararlanabilirsiniz. Online ödemelerinizde siparişiniz sonunda kredi kartınızdan tutar çekim işlemi gerçekleşecektir. Muhtemel sipariş iptali veya stok sorunları nedeniyle sipariş iptallerinde kredi kartınıza para iadesi 3 iş günü içerisinde yapılacaktır.
            </p>
          </section>

          {/* 3. Sipariş Bedeli İadesi */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                3) Sipariş Bedeli İadesi
              </h2>
            </div>
            <p className="text-sm leading-6 text-foreground/90">
              Siparişlerinizin olası sebeplerle iptali durumunda; TARIK BENER EROSHOP üç iş günü içerisinde ürün bedelini hesabınıza ve/veya kredi kartınıza iade eder. Ancak, banka hesap bilgilerinizi ve/veya kredi kartı bilgilerinizi doğru ve eksiksiz olarak şirketimiz finans yetkililerine bildirmeniz gerekmektedir.
            </p>
          </section>

          {/* 4. Teslimat */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                4) Teslimat
              </h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-foreground/90">
              <p>
                Sipariş etmiş olduğunuz ürünleri aynı gün kargoya teslim etmeye gayret ediyoruz. Temini zaman alan ürünler için kargo teslim süresi ürün detayında belirtildiği gibi 3 iş günüdür. Gecikmesi muhtemel teslimat durumunda size bilgi verilecektir.
              </p>
              <p>
                Ürün teslimatının aksamadan gerçekleştirilebilmesi için lütfen gün içinde bulunduğunuz yerin adresini teslimat adresi olarak bildiriniz.
              </p>
              <p>
                Talepleriniz sipariş sonunda belirlemiş olduğunuz teslimat tipine göre hazırlanmak üzere işleme alınacaktır. Mersin merkezli şirketimizden ürünler Yurtiçi kargo firmasıyla gönderilecektir. Siparişleriniz onaylandıktan sonra en geç 2 (iki) iş günü sonunda Kargo firmasına teslim edilir.
              </p>
              <p>
                Müşteri temsilcimize danışarak değişik teslimat şartları konusunda görüşebilirsiniz. Ayrıca kargo teslimatları sadece Türkiye için geçerlidir.
              </p>
            </div>
          </section>

          {/* 5. Ödeme Takibi */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                5) Ödeme Takibi
              </h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-foreground/90">
              <p>
                Söz konusu sistem herhangi bir sorun nedeni ile işlemi gerçekleştiremiyorsa ödeme sayfası sonucunda ziyaretçimiz bu durumdan haberdar edilmektedir.
              </p>
              <p>
                Belirtilen adreste herhangi bir hata durumunda teslimatı gerçekleşemeyen sipariş ile ilgili olarak siparişi veren ile bağlantı kurulmaktadır.
              </p>
              <p>
                Ziyaretçimiz tarafından belirtilen e-posta adresinin geçerliliği siparişin aktarılmasını takiben gönderilen otomatik e-posta ile teyit edilmektedir.
              </p>
              <p>
                Teslimatın gerçekleşmesi konusunda müşteri kadar kredi kartı sistemini kullandığımız bankaya karşı da sorumluluğumuz söz konusudur.
              </p>
            </div>
          </section>

          {/* Lütfen dikkat ediniz! */}
          <section className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-primary">
                Lütfen dikkat ediniz!
              </h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-foreground/90">
              <p>
                Sevkiyat sırasında zarar gördüğünüzü düşündüğünüz paketleri, teslim aldığınız firma yetkilisi önünde açıp kontrol ediniz. Eğer üründe herhangi bir zarar olduğunu düşünüyorsanız kargo firmasına tutanak tutturularak ürünü teslim almayınız.
              </p>
              <p>
                Ürün teslim alındıktan sonra kargo firmasının görevini tam olarak yerine getirdiği kabul edilmektedir.
              </p>
              <p>
                Ürün hasarlı ise: Hazırlamış olduğunuz tutanağı en kısa zamanda{" "}
                <Link
                  href="mailto:info@demo.cinselhobi.com"
                  className="text-primary hover:underline font-medium"
                >
                  info@demo.cinselhobi.com
                </Link>{" "}
                mail adresine bildiriniz.
              </p>
              <p>
                Bu işlemleri gerçekleştirdiğiniz takdirde paketinizle ilgili çalışmalara başlayarak, en kısa zamanda teslimatın tekrarlanmasını sağlayacağız.
              </p>
              <p>
                Bu e-posta içinde ürünü neden iade etmek istediğinizi kısaca açıklarsanız ürün ile ilgili çalışmalarımızda bize yardımcı olmuş olursunuz.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
