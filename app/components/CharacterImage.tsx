'use client';

import Image from 'next/image';
import { useState } from 'react';

interface CharacterImageProps {
  size?: number;
  className?: string;
}

export default function CharacterImage({ size = 120, className = '' }: CharacterImageProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-rose-200 ${className}`}
        style={{ width: size, height: size }}
      >
        <span style={{ fontSize: size * 0.4, color: '#fb923c', fontWeight: 700 }}>J</span>
      </div>
    );
  }

  return (
    <Image
      src="/character.png"
      alt="남친 캐릭터"
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={() => setError(true)}
      priority
    />
  );
}
