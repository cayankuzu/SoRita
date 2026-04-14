import React from 'react';
import { MapPin } from 'lucide-react';

interface SoRitaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function SoRitaLogo({ size = 'md', showIcon = true }: SoRitaLogoProps) {
  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const iconSizes = {
    sm: 'size-5',
    md: 'size-7',
    lg: 'size-10',
  };

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className="flex items-center gap-1.5">
      {showIcon && (
        <div className="relative">
          <MapPin className={`${iconSizes[size]} text-blue-500`} />
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </div>
      )}
      <div className="flex flex-col">
        <span className={`${textSizes[size]} tracking-tight leading-none`} style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
          <span className="text-blue-500">So</span>
          <span className="text-emerald-500">Rita</span>
        </span>
        <span className={`${subtitleSizes[size]} tracking-wide leading-none mt-0.5`} style={{ fontWeight: 500 }}>
          <span className="text-blue-500">Sosyal</span>{' '}
          <span className="text-emerald-500">Harita</span>
        </span>
      </div>
    </div>
  );
}