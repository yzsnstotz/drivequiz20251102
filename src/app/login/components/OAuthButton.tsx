"use client";

import React from "react";

interface OAuthButtonProps {
  provider: string;
  name: string;
  icon: string;
  onClick: () => void;
}

export default function OAuthButton({
  provider,
  name,
  icon,
  onClick,
}: OAuthButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center space-x-3 font-medium text-gray-700"
    >
      <span className="text-2xl">{icon}</span>
      <span>{name}</span>
    </button>
  );
}

