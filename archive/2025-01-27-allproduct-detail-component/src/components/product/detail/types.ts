export interface ProductImage {
  src: string;
  alt?: string;
}

export interface Product {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  images: ProductImage[];
  sku: string | null;
  stockStatus: string | null;
  stockQuantity: number | null;
}

export interface RelatedProduct {
  id: number;
  slug: string;
  name: string;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  currency: string;
  images: ProductImage[];
  stockStatus: string | null;
}

