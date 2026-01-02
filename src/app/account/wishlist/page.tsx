import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listFavoritesByUserId } from "@/db/queries/favorites";
import { WishlistClient } from "@/components/favorites/wishlist-client";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/wishlist");
  }

  const favorites = await listFavoritesByUserId(session.user.id);

  return <WishlistClient initialProducts={favorites} />;
}

