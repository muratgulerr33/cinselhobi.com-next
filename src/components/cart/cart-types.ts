export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  priceCents: number; // required
  imageUrl?: string | null;
  qty: number;
};

export type CartState = {
  items: CartItem[];
};

