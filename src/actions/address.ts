"use server";

import { auth } from "@/auth";
import {
  addAddress as addAddressQuery,
  getAddressesByUserId,
  deleteAddress as deleteAddressQuery,
  updateAddress,
  getAddressById,
} from "@/db/queries/address";
import { z } from "zod";

const addressSchema = z.object({
  title: z.string().min(1, "Başlık gereklidir").max(100, "Başlık çok uzun"),
  fullAddress: z.string().min(5, "Adres en az 5 karakter olmalıdır").max(500, "Adres çok uzun"),
  city: z.string().min(1, "İl gereklidir").max(100, "İl adı çok uzun"),
  district: z.string().min(1, "İlçe gereklidir").max(100, "İlçe adı çok uzun"),
  phone: z
    .string()
    .min(10, "Telefon numarası en az 10 karakter olmalıdır")
    .max(20, "Telefon numarası çok uzun")
    .regex(/^[0-9+\-\s()]+$/, "Geçerli bir telefon numarası giriniz"),
  isDefault: z.boolean().optional(),
});

export async function addAddressAction(data: z.infer<typeof addressSchema>) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const };
  }

  try {
    const validatedData = addressSchema.parse(data);
    const address = await addAddressQuery(session.user.id, validatedData);
    return { ok: true, address };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: "Validation error" as const,
        errors: error.issues,
      };
    }
    console.error("Error adding address:", error);
    return { ok: false, error: "Failed to add address" };
  }
}

export async function getAddressesAction() {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const, addresses: [] };
  }

  try {
    const addresses = await getAddressesByUserId(session.user.id);
    return { ok: true, addresses };
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return { ok: false, error: "Failed to fetch addresses", addresses: [] };
  }
}

const addressIdSchema = z.number().int().positive();

export async function deleteAddressAction(addressId: number) {
  const validationResult = addressIdSchema.safeParse(addressId);
  if (!validationResult.success) {
    return { ok: false, error: "Invalid input" as const };
  }

  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const };
  }

  try {
    // Önce adresin kullanıcıya ait olduğunu kontrol et
    const address = await getAddressById(validationResult.data, session.user.id);
    if (!address) {
      return { ok: false, error: "Address not found" as const };
    }

    await deleteAddressQuery(validationResult.data, session.user.id);
    return { ok: true };
  } catch (error) {
    console.error("Error deleting address:", error);
    return { ok: false, error: "Failed to delete address" };
  }
}

export async function updateAddressAction(
  addressId: number,
  data: Partial<z.infer<typeof addressSchema>>
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" as const };
  }

  try {
    // Önce adresin kullanıcıya ait olduğunu kontrol et
    const address = await getAddressById(addressId, session.user.id);
    if (!address) {
      return { ok: false, error: "Address not found" as const };
    }

    const validatedData = addressSchema.partial().parse(data);
    const updatedAddress = await updateAddress(addressId, session.user.id, validatedData);
    return { ok: true, address: updatedAddress };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: "Validation error" as const,
        errors: error.issues,
      };
    }
    console.error("Error updating address:", error);
    return { ok: false, error: "Failed to update address" };
  }
}

