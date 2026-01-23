import { getAddressesAction } from "@/actions/address";
import { AddressList } from "@/components/account/address-list";
import { AddressForm } from "@/components/account/address-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddressFormButton } from "@/components/account/address-form-button";

export default async function AddressesPage() {
  const result = await getAddressesAction();
  const addresses = result.ok ? result.addresses : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Adreslerim</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Siparişleriniz için adres bilgilerinizi yönetin
          </p>
        </div>
        <AddressFormButton />
      </div>

      <AddressList addresses={addresses} />
    </div>
  );
}
