"use client";

import React from "react";
import { Star } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

interface FavoriteButtonProps {
  questionHash: string | undefined;
  onToggle?: (isFavorite: boolean) => void;
}

export default function FavoriteButton({
  questionHash,
  onToggle,
}: FavoriteButtonProps) {
  const favorite = isFavorite(questionHash);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!questionHash) return;
    const newFavorite = toggleFavorite(questionHash);
    if (onToggle) {
      onToggle(newFavorite);
    }
  };

  if (!questionHash) return null;

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-full transition-colors ${
        favorite
          ? "text-yellow-500 hover:text-yellow-600"
          : "text-gray-400 hover:text-gray-500"
      }`}
      aria-label={favorite ? "取消收藏" : "收藏"}
    >
      <Star
        className={`h-6 w-6 ${favorite ? "fill-current" : ""}`}
      />
    </button>
  );
}

