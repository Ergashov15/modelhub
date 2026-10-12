import React from 'react';

interface ModelHubLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  showBadge?: boolean;
}

export const ModelHubLogo: React.FC<ModelHubLogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
  showBadge = true,
}) => {
  // Dimension definitions
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const roundedClasses = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Logo Mark: Squircle with Emerald Neural Nexus */}
      <div
        className={`${sizeClasses} ${roundedClasses} relative flex items-center justify-center shrink-0 shadow-sm overflow-hidden transition-transform duration-200`}
        style={{
          background: 'linear-gradient(135deg, #10B981 0%, #047857 55%, #064E3B 100%)',
          boxShadow: '0 2px 10px -1px rgba(4, 120, 87, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)',
        }}
      >
        {/* Subtle decorative inner radial glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.7) 0%, transparent 60%)',
          }}
        />

        {/* Vector SVG Emblem: The Modern MH Neural Nexus */}
        <svg
          viewBox="0 0 36 36"
          className="w-full h-full p-1.5 relative z-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle connecting neural web in background */}
          <line
            x1="9"
            y1="18.5"
            x2="27"
            y2="18.5"
            stroke="white"
            strokeWidth="1.2"
            strokeOpacity="0.35"
            strokeDasharray="1.5 1.5"
          />
          <line
            x1="18"
            y1="10"
            x2="18"
            y2="26"
            stroke="white"
            strokeWidth="1"
            strokeOpacity="0.25"
          />

          {/* Main "M" Neural Paths */}
          <path
            d="M9 25V11L18 18.5L27 11V25"
            stroke="white"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* "H" Crossbar connecting pillars through the central hub */}
          <path
            d="M9 18.5H27"
            stroke="white"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeOpacity="0.9"
          />

          {/* Central Hub Halo Ring */}
          <circle cx="18" cy="18.5" r="4" stroke="white" strokeWidth="1" strokeOpacity="0.45" />

          {/* Central Hub Core Node */}
          <circle cx="18" cy="18.5" r="2.2" fill="white" />
          <circle cx="18" cy="18.5" r="1" fill="#047857" />

          {/* Vertex Anchor Nodes (4 outer corners) */}
          <circle cx="9" cy="11" r="1.8" fill="white" />
          <circle cx="27" cy="11" r="1.8" fill="white" />
          <circle cx="9" cy="25" r="1.8" fill="white" />
          <circle cx="27" cy="25" r="1.8" fill="white" />

          {/* Top subtle beacon node */}
          <circle cx="18" cy="10" r="1.2" fill="white" fillOpacity="0.8" />
        </svg>
      </div>

      {/* Typography Branding */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold text-[15px] sm:text-base tracking-tight text-[#1F2937] dark:text-[#ECEBE8]">
              Model<span className="text-[#047857] dark:text-[#34D399]">Hub</span>
            </span>
            {showBadge && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#E6F4EA] dark:bg-[#064E3B]/40 text-[#047857] dark:text-[#6EE7B7] border border-[#86EFAC]/50">
                AI
              </span>
            )}
          </div>
          <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium tracking-wide mt-1 leading-none">
            Workspace
          </span>
        </div>
      )}
    </div>
  );
};
