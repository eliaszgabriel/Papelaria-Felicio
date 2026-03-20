"use client";

import { useMemo, useState } from "react";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";

type ProductColorOption = {
  id: string;
  name: string;
  imageUrl: string;
};

type ProductInfoInput = {
  id: string;
  slug: string;
  title: string;
  price: number;
  oldPrice?: number;
  short: string;
  image?: string;
  stock: number;
  badges?: string[];
  colorOptions?: ProductColorOption[];
};

export default function ProductDetailShell({
  title,
  images,
  product,
}: {
  title: string;
  images: string[];
  product: ProductInfoInput;
}) {
  const colorOptions = useMemo(
    () =>
      Array.isArray(product.colorOptions)
        ? product.colorOptions.filter((option) => option?.name && option?.imageUrl)
        : [],
    [product.colorOptions],
  );
  const [selectedColorId, setSelectedColorId] = useState(colorOptions[0]?.id || "");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const selectedColor =
    colorOptions.find((option) => option.id === selectedColorId) || colorOptions[0] || null;

  function handleSelectColor(nextColorId: string) {
    setSelectedColorId(nextColorId);

    const nextColor = colorOptions.find((option) => option.id === nextColorId);
    if (!nextColor?.imageUrl) return;

    const nextImageIndex = images.findIndex((image) => image === nextColor.imageUrl);
    if (nextImageIndex >= 0) {
      setActiveImageIndex(nextImageIndex);
    }
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-12 lg:gap-7">
      <div className="lg:col-span-7">
        <ProductGallery
          images={images}
          title={title}
          activeIndex={activeImageIndex}
          onSelectIndex={setActiveImageIndex}
          preferredImage={selectedColor?.imageUrl}
        />
      </div>

      <div className="lg:col-span-5">
        <ProductInfo
          product={product}
          selectedColorId={selectedColorId}
          onSelectColor={handleSelectColor}
        />
      </div>
    </div>
  );
}
