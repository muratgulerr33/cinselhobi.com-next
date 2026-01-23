import Link from "next/link";

export default function AccountPage() {
  const menuItems = [
    { href: "/account/orders", label: "Siparişlerim" },
    { href: "/account/wishlist", label: "Favorilerim" },
    { href: "/account/coupons", label: "Kuponlarım" },
    { href: "/account/addresses", label: "Adreslerim" },
    { href: "/account/settings", label: "Ayarlar" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-2xl font-semibold">Hesabım</h1>
        <div className="mt-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3 active:scale-[0.99]"
            >
              <span>{item.label}</span>
              <span>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

