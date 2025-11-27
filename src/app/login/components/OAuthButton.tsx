"use client";

import React from "react";
import { WeChatIcon, LineIcon, GoogleIcon, TwitterIcon, FacebookIcon } from "@/components/OAuthIcons";

interface OAuthButtonProps {
  provider: string;
  name: string;
  icon?: string;
  onClick: () => void;
}

const getProviderIcon = (provider: string, fallbackIcon?: string) => {
  switch (provider.toLowerCase()) {
    case "wechat":
      return <WeChatIcon className="w-6 h-6" />;
    case "line":
      return <LineIcon className="w-6 h-6" />;
    case "google":
      return <GoogleIcon className="w-6 h-6" />;
    case "twitter":
      return <TwitterIcon className="w-6 h-6" />;
    case "facebook":
      return <FacebookIcon className="w-6 h-6" />;
    default:
      return fallbackIcon ? <span className="text-2xl">{fallbackIcon}</span> : null;
  }
};

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
      {getProviderIcon(provider, icon)}
      <span>{name}</span>
    </button>
  );
}

