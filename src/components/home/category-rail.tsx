"use client";

import { useRef, useState, MouseEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CategoryRailProps {
  categories: Category[];
}

export function CategoryRail({ categories = [] }: CategoryRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // HEAVY BUFFER STRATEGY (The "Fake" Infinite)
  // Instead of complex JS math that causes flashing, we duplicate the list 8 times.
  // This is enough for 99% of users to feel it's "infinite" without bugs.
  // Performance cost is negligible for text nodes.
  const infiniteCategories = Array(8).fill(categories).flat().map((cat, idx) => ({
    ...cat,
    uniqueKey: `${cat.id}-${idx}`
  }));

  // --- MOUSE DRAG LOGIC (Smart Snapping) ---
  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
    
    // DISABLE SNAP while dragging (Crucial for smooth feel)
    if (scrollRef.current) {
      scrollRef.current.style.scrollSnapType = 'none';
      scrollRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // RE-ENABLE SNAP when released (So it snaps to a card)
    if (scrollRef.current) {
      scrollRef.current.style.scrollSnapType = 'x mandatory';
      scrollRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (scrollRef.current) {
        scrollRef.current.style.scrollSnapType = 'x mandatory';
        scrollRef.current.style.cursor = 'grab';
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2; // Speed multiplier
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  if (!categories.length) return null;

  return (
    <div className="w-full bg-white dark:bg-black border-b border-gray-100 dark:border-zinc-800 py-4 transition-colors">
      <div className="container mx-auto">
        <div 
          ref={scrollRef}
          className={cn(
            "flex gap-3 overflow-x-auto px-4 md:px-0 pb-4 scrollbar-hide select-none",
            "cursor-grab",
            // SNAP LOGIC: Mandatory = Always stop on an item. x = Horizontal.
            "snap-x snap-mandatory"
          )}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {infiniteCategories.map((cat) => (
            <Link
              key={cat.uniqueKey}
              href={`/${cat.slug}`}
              draggable={false}
              className={cn(
                // SNAP ALIGN: Start = Item aligns to left edge.
                "snap-start flex-shrink-0 px-6 py-3 rounded-full transition-colors duration-200 select-none",
                // NATIVE POLISH COLORS
                "bg-[#F3F4F6] text-gray-900 hover:bg-[#E5E7EB]", // Light
                "dark:bg-[#27272a] dark:text-zinc-100 dark:hover:bg-[#3f3f46]", // Dark
                "font-medium text-sm tracking-wide"
              )}
            >
              {cat.name}
            </Link>
          ))}
          {/* Right padding buffer so last item isn't flush against edge */}
          <div className="w-4 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}
