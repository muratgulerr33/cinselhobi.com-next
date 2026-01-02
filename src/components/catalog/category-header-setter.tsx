"use client";

import { useEffect, useMemo } from "react";
import { useHeaderContext } from "@/components/layout/header-context";

interface CategoryHeaderSetterProps {
  categorySlug: string;
  childCategories?: Array<{ id: number; wcId: number; name: string; slug: string }>;
}

export function CategoryHeaderSetter({
  categorySlug,
  childCategories,
}: CategoryHeaderSetterProps) {
  const { setCategoryInfo } = useHeaderContext();

  const childKey = useMemo(
    () => (childCategories ?? []).map((c) => c.id).join(","),
    [childCategories]
  );

  useEffect(() => {
    setCategoryInfo({
      slug: categorySlug,
      childCategories,
      childKey,
    });

    return () => {
      setCategoryInfo(null);
    };
  }, [setCategoryInfo, categorySlug, childKey]);

  return null;
}

