"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { ProductCard } from "@/components/catalog/product-card";
import type { RelatedProduct } from "./types";

interface RelatedProductsCarouselProps {
  products: RelatedProduct[];
}

export function RelatedProductsCarousel({ products }: RelatedProductsCarouselProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Bunlar da ilgini çekebilir
      </h2>
      <div className="w-full max-w-full min-w-0 overflow-hidden px-1">
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full max-w-full min-w-0"
        >
          <CarouselContent className="pr-4">
            {products.map((product) => {
              const relatedPrice = product.salePrice ?? product.price ?? product.regularPrice ?? 0;
              const relatedImages = product.images.map((img) => img.src);

              return (
                <CarouselItem
                  key={`related-${product.id}-${product.slug}`}
                  className="!basis-1/2 md:!basis-1/3 lg:!basis-1/4"
                >
                  <div className="p-2">
                    <ProductCard
                      product={{
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        price: relatedPrice,
                        images: relatedImages,
                        stockStatus: product.stockStatus,
                      }}
                    />
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}

