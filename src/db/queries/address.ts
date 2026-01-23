import { db } from "@/db/connection";
import { userAddresses } from "@/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";

export interface AddressData {
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault?: boolean;
}

export async function addAddress(userId: string, data: AddressData) {
  // Eğer bu adres default olarak işaretlenmişse, diğer adreslerin default'unu kaldır
  if (data.isDefault) {
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));
  }

  const [result] = await db
    .insert(userAddresses)
    .values({
      userId,
      title: data.title,
      fullAddress: data.fullAddress,
      city: data.city,
      district: data.district,
      phone: data.phone,
      isDefault: data.isDefault ?? false,
    })
    .returning();

  return result;
}

export async function getAddressesByUserId(userId: string) {
  const result = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, userId))
    .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));

  return result;
}

export async function getAddressById(addressId: number, userId: string) {
  const [result] = await db
    .select()
    .from(userAddresses)
    .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)))
    .limit(1);

  return result;
}

export async function deleteAddress(addressId: number, userId: string) {
  await db
    .delete(userAddresses)
    .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)));
}

export async function updateAddress(
  addressId: number,
  userId: string,
  data: Partial<AddressData>
) {
  // Eğer bu adres default olarak işaretlenmişse, diğer adreslerin default'unu kaldır
  if (data.isDefault) {
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(and(eq(userAddresses.userId, userId), ne(userAddresses.id, addressId)));
  }

  const [result] = await db
    .update(userAddresses)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)))
    .returning();

  return result;
}

