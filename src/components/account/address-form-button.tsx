"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddressForm } from "./address-form";
import { Plus } from "lucide-react";

export function AddressFormButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="h-11">
        <Plus className="h-4 w-4 mr-2" />
        Yeni Adres Ekle
      </Button>
      <AddressForm open={open} onOpenChange={setOpen} />
    </>
  );
}

