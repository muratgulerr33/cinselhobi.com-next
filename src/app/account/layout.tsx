import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AccountSidebar, AccountMobileNav } from "@/components/account/AccountSidebar";

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/account")
  
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4">
      <div className="xl:hidden mb-4">
        <AccountMobileNav />
      </div>
      <div className="gap-6 xl:grid xl:grid-cols-[280px_1fr]">
        <AccountSidebar />
        <div>{children}</div>
      </div>
    </div>
  );
}

