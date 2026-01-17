"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addAddressAction } from "@/actions/address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { saveCheckoutAddressIntent } from "@/lib/checkout-address-intent";
import { toast } from "sonner";

const addressSchema = z.object({
  title: z.string().min(1, "Başlık gereklidir").max(100, "Başlık çok uzun"),
  fullAddress: z.string().min(5, "Adres en az 5 karakter olmalıdır").max(500, "Adres çok uzun"),
  city: z.string().min(1, "İl gereklidir").max(100, "İl adı çok uzun"),
  district: z.string().min(1, "İlçe gereklidir").max(100, "İlçe adı çok uzun"),
  phone: z
    .string()
    .min(10, "Telefon numarası en az 10 karakter olmalıdır")
    .max(20, "Telefon numarası çok uzun")
    .regex(/^[0-9+\-\s()]+$/, "Geçerli bir telefon numarası giriniz"),
  isDefault: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Address {
  id: number;
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault: boolean;
}

interface AddressFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "account" | "checkout";
  onCreated?: (address: Address) => void;
}

export function AddressForm({ open, onOpenChange, mode = "account", onCreated }: AddressFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      title: "",
      fullAddress: "",
      city: "",
      district: "",
      phone: "",
      isDefault: false,
    },
  });

  const onSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true);
    setError(null);

    // EN ÜSTTE: Checkout mode'da guest ise server action tetiklenmeden önce intent kaydet ve login'e yönlendir
    if (mode === "checkout" && !isAuthenticated) {
      const from = window.location.pathname + window.location.search + window.location.hash;
      saveCheckoutAddressIntent({ ...data, from, createdAt: Date.now() });
      toast.success("Giriş yapmanız gerekiyor. Adres bilgileriniz kaydedildi.");
      onOpenChange(false);
      router.push(`/login?callbackUrl=${encodeURIComponent("/checkout")}`);
      setIsSubmitting(false);
      return; // KRİTİK: aşağıdaki addAddressAction asla çalışmamalı
    }

    // Güvenlik için ikinci guard: authenticated olmayan kullanıcılar için return
    if (!isAuthenticated) {
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await addAddressAction(data);
      if (result.ok && result.address) {
        // Authenticated checkout mode'da callback'i çağır (guest intent akışını bozmadan)
        if (mode === "checkout" && isAuthenticated && onCreated) {
          onCreated(result.address);
        }
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        if (result.error === "Validation error" && result.errors) {
          const firstError = result.errors[0];
          setError(firstError?.message || "Form hatası");
        } else {
          setError(result.error || "Adres eklenirken bir hata oluştu");
        }
      }
    } catch (err) {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Yeni Adres Ekle</DrawerTitle>
          <DrawerDescription>
            Siparişleriniz için adres bilgilerinizi giriniz
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-4 pb-4">
          {error && (
            <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Adres Başlığı <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                type="text"
                placeholder="Örn: Ev, İş, Anne"
                className="h-11"
                {...register("title")}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="fullAddress" className="block text-sm font-medium mb-2">
                Açık Adres <span className="text-destructive">*</span>
              </label>
              <textarea
                id="fullAddress"
                rows={3}
                placeholder="Mahalle, sokak, bina no, daire no..."
                className="flex min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                {...register("fullAddress")}
              />
              {errors.fullAddress && (
                <p className="mt-1 text-sm text-destructive">{errors.fullAddress.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium mb-2">
                  İl <span className="text-destructive">*</span>
                </label>
                <Input
                  id="city"
                  type="text"
                  placeholder="İstanbul"
                  className="h-11"
                  {...register("city")}
                />
                {errors.city && (
                  <p className="mt-1 text-sm text-destructive">{errors.city.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="district" className="block text-sm font-medium mb-2">
                  İlçe <span className="text-destructive">*</span>
                </label>
                <Input
                  id="district"
                  type="text"
                  placeholder="Kadıköy"
                  className="h-11"
                  {...register("district")}
                />
                {errors.district && (
                  <p className="mt-1 text-sm text-destructive">{errors.district.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2">
                Telefon <span className="text-destructive">*</span>
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="0555 123 45 67"
                className="h-11"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                {...register("isDefault")}
              />
              <label htmlFor="isDefault" className="text-sm font-medium cursor-pointer">
                Varsayılan adres olarak ayarla
              </label>
            </div>
          </div>
        </form>

        <DrawerFooter>
          <Button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || (mode === "checkout" && isAuthLoading)}
            className="w-full h-11"
          >
            {isSubmitting ? "Kaydediliyor..." : "Adresi Kaydet"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full h-11" disabled={isSubmitting}>
              İptal
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

