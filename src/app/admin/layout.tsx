import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/admin")

  // role yoksa veya admin değilse
  if (session.user?.role !== "admin") redirect("/account")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}



