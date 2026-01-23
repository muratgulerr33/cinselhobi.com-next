"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { OrderStatus, updateOrderStatus } from "@/actions/admin";
import { useRouter } from "next/navigation";

interface OrderStatusUpdateFormProps {
  orderId: string;
  currentStatus: OrderStatus;
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Beklemede" },
  { value: "processing", label: "İşleniyor" },
  { value: "shipped", label: "Kargoda" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal Edildi" },
];

export function OrderStatusUpdateForm({
  orderId,
  currentStatus,
}: OrderStatusUpdateFormProps) {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (selectedStatus === currentStatus) {
      return;
    }

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, selectedStatus);
      
      if (result.success) {
        setSuccess(true);
        router.refresh();
        // Başarı mesajını 3 saniye sonra kaldır
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Bir hata oluştu");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium mb-2"
        >
          Durum
        </label>
        <select
          id="status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/15 text-green-700 dark:text-green-400 text-sm p-3">
          Sipariş durumu başarıyla güncellendi!
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || selectedStatus === currentStatus}
        className="w-full sm:w-auto"
      >
        {isPending ? "Güncelleniyor..." : "Durumu Güncelle"}
      </Button>
    </form>
  );
}

