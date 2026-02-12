"use client";

import { deleteAddressAction } from "@/actions/address";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, MapPin } from "lucide-react";

interface Address {
  id: number;
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AddressListProps {
  addresses: Address[];
}

export function AddressList({ addresses }: AddressListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (addressId: number) => {
    setDeletingId(addressId);
    try {
      const result = await deleteAddressAction(addressId);
      if (result.ok) {
        router.refresh();
      } else {
        alert("Adres silinirken bir hata oluştu");
      }
    } catch (error) {
      alert("Beklenmeyen bir hata oluştu");
    } finally {
      setDeletingId(null);
    }
  };

  if (addresses.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Henüz adres eklenmemiş</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {addresses.map((address) => (
        <div
          key={address.id}
          className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{address.title}</h3>
                {address.isDefault && (
                  <Badge variant="default" className="text-xs">
                    Varsayılan
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {address.fullAddress}
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{address.district}</span>
                <span>•</span>
                <span>{address.city}</span>
                <span>•</span>
                <span>{address.phone}</span>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deletingId === address.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Adresi Sil</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bu adresi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(address.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingId === address.id ? "Siliniyor..." : "Sil"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}

