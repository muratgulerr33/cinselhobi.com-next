"use client";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  // Bu bileşen header'da başlık göstermek için kullanılır
  // Şimdilik boş bırakıyoruz, gerekirse document.title veya başka bir mekanizma eklenebilir
  if (typeof window !== "undefined") {
    document.title = title;
  }
  return null;
}

