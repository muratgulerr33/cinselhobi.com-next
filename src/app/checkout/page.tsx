"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Script from "next/script";
import { useCart } from "@/components/cart/cart-provider";
import { getAddressesAction } from "@/actions/address";
import { createOrderAction, getPayTRConfigStatus } from "@/actions/checkout";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AddressForm } from "@/components/account/address-form";
import { CheckoutAddressIntentConsumer } from "@/components/checkout/checkout-address-intent-consumer";
import { Plus, MapPin, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MockCreditCardProvider } from "@/lib/payments/mock-credit-card-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Address {
  id: number;
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault: boolean;
}

// Development kontrolü (client-side)
const isDevelopment = process.env.NODE_ENV === "development";

export default function CheckoutPage() {
  const router = useRouter();
  const { status } = useSession();
  const { items, subtotalCents } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "cod">("cod");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [didRedirectToSuccess, setDidRedirectToSuccess] = useState(false);
  const loadAddressesCalledRef = useRef(false);
  // Dev-only: Test senaryosu seçimi
  const [testScenario, setTestScenario] = useState<"success" | "fail" | "threeDSRequired">("success");
  // 3DS modal state (dev-only mock için)
  const [showThreeDSModal, setShowThreeDSModal] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<"credit_card" | null>(null);
  // PayTR iFrame modal state
  const [showPayTRModal, setShowPayTRModal] = useState(false);
  const [payTRIframeToken, setPayTRIframeToken] = useState<string | null>(null);
  const [payTROrderId, setPayTROrderId] = useState<string | null>(null);
  const payTRIframeRef = useRef<HTMLIFrameElement>(null);
  const [paytrConfigured, setPaytrConfigured] = useState<boolean>(false);

  // Hydration guard: cart state'in yüklenmesini bekle
  useEffect(() => {
    setHydrated(true);
  }, []);

  // PayTR yapılandırma durumunu kontrol et
  useEffect(() => {
    getPayTRConfigStatus().then((result) => {
      setPaytrConfigured(result.configured);
    });
  }, []);

  // loadAddresses fonksiyonunu useCallback ile memoize et
  const loadAddresses = useCallback(async () => {
    setIsLoadingAddresses(true);
    const result = await getAddressesAction();
    if (result.ok && result.addresses) {
      setAddresses(result.addresses);
      // Varsayılan adresi seç
      const defaultAddress = result.addresses.find((a) => a.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (result.addresses.length > 0) {
        setSelectedAddressId(result.addresses[0].id);
      }
    }
    setIsLoadingAddresses(false);
  }, []);

  useEffect(() => {
    // Sadece authenticated durumunda adres yükle
    if (status !== "authenticated") {
      setIsLoadingAddresses(false);
      return;
    }

    // Authenticated olunca loadAddresses sadece 1 kere çalışsın (useRef guard ile)
    if (loadAddressesCalledRef.current) {
      return;
    }
    loadAddressesCalledRef.current = true;
    loadAddresses();
  }, [status, loadAddresses]);

  // Optimistic update için upsertById helper
  const upsertAddress = useCallback((newAddress: Address) => {
    setAddresses((prev) => {
      const existingIndex = prev.findIndex((a) => a.id === newAddress.id);
      if (existingIndex >= 0) {
        // Mevcut adresi güncelle (idempotent davranış)
        const updated = [...prev];
        updated[existingIndex] = newAddress;
        return updated;
      } else {
        // Yeni adresi ekle
        return [...prev, newAddress];
      }
    });
    // Yeni eklenen adresi seçili yap
    setSelectedAddressId(newAddress.id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAddressId) {
      setError("Lütfen bir adres seçiniz");
      return;
    }

    if (items.length === 0) {
      setError("Sepetiniz boş");
      router.push("/cart");
      return;
    }

    setIsLoading(true);

    try {
      // COD akışı: Direkt order oluştur
      if (paymentMethod === "cod") {
        // selectedAddressId guard'da kontrol edildi, burada null olamaz
        const result = await createOrderAction({
          addressId: selectedAddressId!,
          paymentMethod,
          cartItems: items.map((item) => ({
            productId: item.productId,
            quantity: item.qty,
          })),
        });

        if (result.ok && result.orderId) {
          setDidRedirectToSuccess(true);
          router.push(`/order-success/${result.orderId}`);
        } else {
          if (result.error === "Validation error" && result.errors) {
            const firstError = result.errors[0];
            setError(firstError?.message || "Form hatası");
          } else {
            setError(result.error || "Sipariş oluşturulurken bir hata oluştu");
          }
        }
        return;
      }

      // Credit Card akışı
      if (paymentMethod === "credit_card") {
        // Development'ta Mock provider ile test
        if (isDevelopment) {
          const paymentProvider = new MockCreditCardProvider(testScenario);
          const paymentResult = await paymentProvider.startPayment({
            amount: subtotalCents,
          });

          if (paymentResult.type === "fail") {
            setError(paymentResult.error);
            setIsLoading(false);
            return;
          }

          if (paymentResult.type === "threeDSRequired") {
            // 3DS modal'ı göster
            setPendingPaymentMethod("credit_card");
            setShowThreeDSModal(true);
            setIsLoading(false);
            return;
          }

          // Success: Order oluştur
          if (paymentResult.type === "success") {
            // selectedAddressId guard'da kontrol edildi, burada null olamaz
            const result = await createOrderAction({
              addressId: selectedAddressId!,
              paymentMethod,
              cartItems: items.map((item) => ({
                productId: item.productId,
                quantity: item.qty,
              })),
            });

            if (result.ok && result.orderId) {
              setDidRedirectToSuccess(true);
              router.push(`/order-success/${result.orderId}`);
            } else {
              if (result.error === "Validation error" && result.errors) {
                const firstError = result.errors[0];
                setError(firstError?.message || "Form hatası");
              } else {
                setError(result.error || "Sipariş oluşturulurken bir hata oluştu");
              }
            }
            return;
          }
        } else {
          // Production: createOrderAction çağır, PayTR token al ve iframe göster
          const result = await createOrderAction({
            addressId: selectedAddressId!,
            paymentMethod,
            cartItems: items.map((item) => ({
              productId: item.productId,
              quantity: item.qty,
            })),
          });

          if (result.ok && result.paytr) {
            // PayTR token alındı, iframe modal'ı göster
            setPayTRIframeToken(result.paytr.iframeToken);
            setPayTROrderId(result.paytr.orderId);
            setShowPayTRModal(true);
            setIsLoading(false);
            return;
          } else if (result.ok && result.orderId) {
            // COD veya başka bir durum (buraya gelmemeli credit_card için)
            setDidRedirectToSuccess(true);
            router.push(`/order-success/${result.orderId}`);
          } else {
            if (result.error === "Validation error" && result.errors) {
              const firstError = result.errors[0];
              setError(firstError?.message || "Form hatası");
            } else {
              setError(result.error || "Sipariş oluşturulurken bir hata oluştu");
            }
            setIsLoading(false);
          }
          return;
        }
      }
    } catch (err) {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      if (!didRedirectToSuccess && !showThreeDSModal) {
        setIsLoading(false);
      }
    }
  };

  // 3DS modal'da onaylandığında
  const handleThreeDSConfirm = async () => {
    if (!selectedAddressId) {
      setError("Lütfen bir adres seçiniz");
      setShowThreeDSModal(false);
      setPendingPaymentMethod(null);
      return;
    }

    setShowThreeDSModal(false);
    setIsLoading(true);

    try {
      // selectedAddressId kontrol edildi, burada null olamaz
      // paymentMethod'u hardcode olarak "credit_card" kullan
      const result = await createOrderAction({
        addressId: selectedAddressId!,
        paymentMethod: "credit_card",
        cartItems: items.map((item) => ({
          productId: item.productId,
          quantity: item.qty,
        })),
      });

      if (result.ok && result.orderId) {
        setPendingPaymentMethod(null);
        setDidRedirectToSuccess(true);
        router.push(`/order-success/${result.orderId}`);
      } else {
        if (result.error === "Validation error" && result.errors) {
          const firstError = result.errors[0];
          setError(firstError?.message || "Form hatası");
        } else {
          setError(result.error || "Sipariş oluşturulurken bir hata oluştu");
        }
        setPendingPaymentMethod(null);
        setIsLoading(false);
      }
    } catch (err) {
      setError("Beklenmeyen bir hata oluştu");
      setPendingPaymentMethod(null);
      setIsLoading(false);
    }
  };

  // Hydration tamamlanmadan "cart empty" mesajını gösterme
  if (!hydrated) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-4">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-4">Sepetiniz boş</p>
          <Link href="/">
            <Button>Alışverişe Devam Et</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-6">Sipariş Özeti</h1>

      {error && (
        <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Taraf - Adres ve Ödeme */}
        <div className="lg:col-span-2 space-y-6">
          {/* Adres Seçimi */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Teslimat Adresi
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddressForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Yeni Adres
              </Button>
            </div>

            {isLoadingAddresses ? (
              <p className="text-sm text-muted-foreground">Adresler yükleniyor...</p>
            ) : addresses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">Henüz adres eklenmemiş</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddressForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  İlk Adresini Ekle
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                      selectedAddressId === address.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={address.id}
                      checked={selectedAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                      className="mt-1 h-4 w-4 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{address.title}</span>
                        {address.isDefault && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                            Varsayılan
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{address.fullAddress}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {address.district}, {address.city} • {address.phone}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Ödeme Yöntemi */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Ödeme Yöntemi
            </h2>
            <div className="space-y-3">
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                  paymentMethod === "cod"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/50"
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="h-4 w-4 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">Kapıda Ödeme</div>
                  <div className="text-xs text-muted-foreground">
                    Teslimat sırasında nakit veya kredi kartı ile ödeme
                  </div>
                </div>
              </label>
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                  !paytrConfigured && !isDevelopment
                    ? "border-border bg-muted/30 cursor-not-allowed opacity-60"
                    : paymentMethod === "credit_card"
                    ? "border-primary bg-primary/5 cursor-pointer"
                    : "border-border bg-background hover:border-primary/50 cursor-pointer"
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value="credit_card"
                  checked={paymentMethod === "credit_card"}
                  onChange={() => setPaymentMethod("credit_card")}
                  disabled={!paytrConfigured && !isDevelopment}
                  className="h-4 w-4 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed"
                />
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">Kredi Kartı</div>
                  <div className="text-xs text-muted-foreground">
                    {!paytrConfigured && !isDevelopment
                      ? "Yakında"
                      : isDevelopment
                      ? "Test modu (sadece development)"
                      : "Güvenli ödeme (PayTR)"}
                  </div>
                </div>
              </label>
            </div>

            {/* Dev-only: Test Senaryosu Seçici */}
            {isDevelopment && paymentMethod === "credit_card" && (
              <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30">
                <label className="text-sm font-medium mb-2 block">Test Senaryosu</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="testScenario"
                      value="success"
                      checked={testScenario === "success"}
                      onChange={(e) =>
                        setTestScenario(e.target.value as "success" | "fail" | "threeDSRequired")
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Başarılı Ödeme</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="testScenario"
                      value="fail"
                      checked={testScenario === "fail"}
                      onChange={(e) =>
                        setTestScenario(e.target.value as "success" | "fail" | "threeDSRequired")
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Başarısız Ödeme</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="testScenario"
                      value="threeDSRequired"
                      checked={testScenario === "threeDSRequired"}
                      onChange={(e) =>
                        setTestScenario(e.target.value as "success" | "fail" | "threeDSRequired")
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">3D Secure Gerekli</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sağ Taraf - Özet */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-4 sticky top-4">
            <h2 className="text-lg font-semibold mb-4">Sipariş Özeti</h2>

            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-border bg-background" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.qty} adet × {formatPrice(item.priceCents)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ara Toplam</span>
                <span className="font-medium">{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kargo</span>
                <span className="font-medium">Ücretsiz</span>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold pt-2 border-t border-border">
                <span>Toplam</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !selectedAddressId || items.length === 0}
              className="w-full mt-4 h-11"
            >
              {isLoading ? "İşleniyor..." : "Siparişi Tamamla"}
            </Button>
          </div>
        </div>
      </form>

      <AddressForm
        open={showAddressForm}
        onOpenChange={setShowAddressForm}
        mode="checkout"
        onCreated={upsertAddress}
      />
      {/* CheckoutAddressIntentConsumer'ı sadece 1 kere render et */}
      <CheckoutAddressIntentConsumer onApplied={loadAddresses} />

      {/* 3DS Modal (dev-only mock) */}
      <Dialog open={showThreeDSModal} onOpenChange={setShowThreeDSModal}>
        <DialogContent
          hideCloseButton
          className={cn(
            "!top-auto !bottom-0 !translate-y-0 !left-1/2 !-translate-x-1/2",
            "!w-[calc(100vw-1rem)] !max-w-none sm:!max-w-[420px]",
            "!rounded-t-3xl !rounded-b-none",
            "max-h-[calc(100vh-1rem)] overflow-y-auto",
            "pb-[calc(16px+env(safe-area-inset-bottom))]"
          )}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/10" aria-hidden />
          <DialogHeader>
            <DialogTitle>3D Secure Doğrulama</DialogTitle>
            <DialogDescription>
              Lütfen ödemenizi onaylamak için aşağıdaki bilgileri kontrol edin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tutar:</span>
                <span className="font-medium">{formatPrice(subtotalCents)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Bu bir test ekranıdır. Gerçek ödeme entegrasyonunda banka doğrulama sayfası
                gösterilecektir.
              </p>
            </div>
          </div>
          <DialogFooter className="pb-[calc(8px+env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              onClick={() => {
                setShowThreeDSModal(false);
                setPendingPaymentMethod(null);
                setError("3D Secure doğrulaması iptal edildi");
              }}
            >
              Vazgeç
            </Button>
            <Button onClick={handleThreeDSConfirm}>Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PayTR iFrame Modal */}
      <Dialog open={showPayTRModal} onOpenChange={(open) => {
        if (!open) {
          // Modal kapatıldığında state'i temizle
          setShowPayTRModal(false);
          setPayTRIframeToken(null);
          setPayTROrderId(null);
        }
      }}>
        <DialogContent
          className={cn(
            "!max-w-4xl !w-[calc(100vw-2rem)]",
            "max-h-[calc(100vh-2rem)] overflow-hidden",
            "flex flex-col"
          )}
          onEscapeKeyDown={(e) => {
            // Modal kapatılabilir ama kullanıcıya uyarı ver
            if (confirm("Ödeme işlemini iptal etmek istediğinize emin misiniz?")) {
              setShowPayTRModal(false);
              setPayTRIframeToken(null);
              setPayTROrderId(null);
            } else {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Güvenli Ödeme</DialogTitle>
            <DialogDescription>
              Lütfen kart bilgilerinizi aşağıdaki formda giriniz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-[500px]">
            {payTRIframeToken && (
              <>
                <Script
                  src="https://www.paytr.com/js/iframeResizer.min.js"
                  strategy="lazyOnload"
                  onLoad={() => {
                    // iframeResizer script yüklendikten sonra iFrame'i resize et
                    if (
                      typeof window !== "undefined" &&
                      typeof (window as unknown as { iFrameResize?: unknown }).iFrameResize ===
                        "function"
                    ) {
                      const iframe = document.getElementById("paytriframe") as HTMLIFrameElement;
                      if (iframe) {
                        const iFrameResize = (window as unknown as {
                          iFrameResize: (options: unknown, selector: string) => void;
                        }).iFrameResize;
                        iFrameResize({}, "#paytriframe");
                      }
                    }
                  }}
                />
                <iframe
                  id="paytriframe"
                  ref={payTRIframeRef}
                  src={`https://www.paytr.com/odeme/guvenli/${payTRIframeToken}`}
                  style={{
                    width: "100%",
                    border: "none",
                    minHeight: "500px",
                  }}
                  scrolling="no"
                  title="PayTR Ödeme Formu"
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* iframeResizer script yüklendikten sonra resize et */}
      {showPayTRModal && payTRIframeToken && (
        <Script
          id="paytr-iframe-resizer-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof iFrameResize !== 'undefined') {
                iFrameResize({}, '#paytriframe');
              } else {
                window.addEventListener('load', function() {
                  if (typeof iFrameResize !== 'undefined') {
                    iFrameResize({}, '#paytriframe');
                  }
                });
              }
            `,
          }}
        />
      )}
    </div>
  );
}

