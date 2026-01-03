'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import '@/styles/Button-dock.scss';

// Types for the component
interface DockApp {
  id: string;
  name: string;
  icon: string;
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick: (appId: string) => void;
  openApps?: string[];
  className?: string;
}

const MacOSDock: React.FC<MacOSDockProps> = ({ 
  apps, 
  onAppClick, 
  openApps = [],
  className = ''
}) => {
  const dockRef = useRef<HTMLDivElement>(null);

  // Responsive size calculations based on viewport
  const getResponsiveConfig = useCallback(() => {
    if (typeof window === 'undefined') {
      return { baseIconSize: 64 };
    }

    // Base calculations on smaller dimension for better mobile experience
    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    
    // Scale icon size based on screen size
    if (smallerDimension < 480) {
      // Mobile phones
      return {
        baseIconSize: Math.max(40, smallerDimension * 0.08)
      };
    } else if (smallerDimension < 768) {
      // Tablets
      return {
        baseIconSize: Math.max(48, smallerDimension * 0.07)
      };
    } else if (smallerDimension < 1024) {
      // Small laptops
      return {
        baseIconSize: Math.max(56, smallerDimension * 0.06)
      };
    } else {
      // Desktop and large screens
      return {
        baseIconSize: Math.max(64, Math.min(80, smallerDimension * 0.05))
      };
    }
  }, []);

  const [config, setConfig] = useState(getResponsiveConfig);
  const { baseIconSize } = config;

  // Update config on window resize
  useEffect(() => {
    const handleResize = () => {
      setConfig(getResponsiveConfig());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveConfig]);

  const handleAppClick = (appId: string, index: number) => {    
    onAppClick(appId);
  };

  return (
    <div className={className} style={{ position: 'relative', height: '100%' }}>
      <div 
        className="dock" 
        ref={dockRef}
      >
        <div className="dock-container">
          {apps.map((app, index) => {
            const scaledSize = baseIconSize;
            const isBin = index === apps.length - 1;
            const liClass = `li-${index + 1}${isBin ? ' li-bin' : ''}`;
            const imgClass = isBin ? 'ico ico-bin' : 'ico';

            return (
              <li
                key={app.id}
                className={liClass}
                style={{
                  width: `${scaledSize}px`,
                  height: `${scaledSize}px`,
                }}
                onClick={() => handleAppClick(app.id, index)}
              >
                <div className="name">{app.name}</div>
                <img
                  className={imgClass}
                  src={app.icon}
                  alt=""
                />
                {openApps.includes(app.id) && (
                  <div
                    style={{
                      position: 'absolute',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.5)',
                      bottom: '2px',
                      left: '50%',
                      transform: 'translateX(-50%)'
                    }}
                  />
                )}
              </li>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MacOSDock;