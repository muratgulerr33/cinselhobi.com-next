import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button variant="destructive" className="w-full sm:w-auto gap-2">
        <LogOut className="h-4 w-4" />
        Çıkış Yap
      </Button>
    </form>
  );
}
