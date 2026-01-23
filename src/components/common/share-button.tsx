"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  text?: string;
  className?: string;
}

export function ShareButton({ title, text, className }: ShareButtonProps) {
  const handleShare = async () => {
    const url = window.location.href;
    const shareData: ShareData = {
      title,
      text: text || title,
      url,
    };

    // Web Share API'yi dene
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // Kullanıcı paylaşımı iptal etti veya hata oluştu
        if (error instanceof Error && error.name !== "AbortError") {
          // AbortError dışındaki hatalar için fallback'e geç
          fallbackToClipboard(url);
        }
      }
    } else {
      // Web Share API desteklenmiyorsa Clipboard API'ye geç
      fallbackToClipboard(url);
    }
  };

  const fallbackToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopyalandı!");
    } catch (error) {
      toast.error("Link kopyalanamadı. Lütfen tekrar deneyin.");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleShare}
      className={cn("h-11 w-11 text-primary hover:text-primary/80", className)}
      aria-label="Paylaş"
    >
      <Share2 className="h-5 w-5" />
    </Button>
  );
}

