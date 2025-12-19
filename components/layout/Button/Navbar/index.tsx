'use client';

import React from 'react';
import MacOSMenuBar from './Button-menu-bar';

/**
 * Default Demo - Basic MacOS Menu Bar
 *
 * Clean demo showing just the menu bar component.
 */
export default function DefaultDemo() {
  return (
    <div>
      <div style={{
        position: 'absolute',
        top: '3%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        zIndex: 9999,
        maxWidth: '1200px'
      }}>
        <MacOSMenuBar
          onMenuAction={(action) => {
            console.log('Menu action:', action);
          }}
        />
      </div>
    </div>
  );
}