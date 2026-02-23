'use client';

import { useState, useEffect } from 'react';

type SizeType = 'sm' | 'md' | 'lg';

interface ComingSoonBadgeProps {
  size?: SizeType;
  text?: string;
}

export const ComingSoonBadge: React.FC<ComingSoonBadgeProps> = ({
  size = 'md',
  text = 'Coming Soon',
}) => {
  const [scale, setScale] = useState(1);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div
      className="inline-block"
      onMouseEnter={() => setScale(1.05)}
      onMouseLeave={() => setScale(1)}
    >
      <div
        className={`
          ${sizeClasses[size]}
          font-semibold
          rounded-full
          bg-gradient-to-r from-purple-500 to-blue-500
          text-white
          shadow-lg
          transition-transform duration-200
          flex items-center justify-center
          whitespace-nowrap
          cursor-default
          animate-pulse
        `}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ComingSoonBadge;
