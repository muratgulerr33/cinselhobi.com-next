"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";
import { getAddressesAction } from "@/actions/address";
import { createOrderAction } from "@/actions/checkout";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AddressForm } from "@/components/account/address-form";
import { CheckoutAddressIntentConsumer } from "@/components/checkout/checkout-address-intent-consumer";
import { Plus, MapPin, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Address {
  id: number;
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotalCents, clear } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "cod">("cod");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);

  const loadAddresses = async () => {
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
  };

  useEffect(() => {
    loadAddresses();
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
      const result = await createOrderAction({
        addressId: selectedAddressId,
        paymentMethod,
        cartItems: items.map((item) => ({
          productId: item.productId,
          quantity: item.qty,
        })),
      });

      if (result.ok && result.orderId) {
        clear();
        router.push(`/order-success/${result.orderId}`);
      } else {
        if (result.error === "Validation error" && result.errors) {
          const firstError = result.errors[0];
          setError(firstError?.message || "Form hatası");
        } else {
          setError(result.error || "Sipariş oluşturulurken bir hata oluştu");
        }
      }
    } catch (err) {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

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
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors opacity-50",
                  "border-border bg-background"
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value="credit_card"
                  checked={paymentMethod === "credit_card"}
                  disabled
                  className="h-4 w-4"
                />
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">Kredi Kartı</div>
                  <div className="text-xs text-muted-foreground">Yakında aktif olacak</div>
                </div>
              </label>
            </div>
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
        onSuccess={loadAddresses}
      />

      <CheckoutAddressIntentConsumer
        existingAddresses={addresses}
        onAddressAdded={loadAddresses}
        onDone={() => setShowAddressForm(false)}
      />
    </div>
  );
}

