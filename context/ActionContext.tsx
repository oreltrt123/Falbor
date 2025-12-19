'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Action {
  actionType: 'deploy' | 'export' | null;
  // add more fields later if needed
}

interface ActionContextType {
  action: Action | null;
  setAction: (action: Action | null) => void;
}

// 1. Create the context (only once)
const ActionContext = createContext<ActionContextType | undefined>(undefined);

// 2. Provider component
export function ActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<Action | null>(null);

  return (
    <ActionContext.Provider value={{ action, setAction }}>
      {children}
    </ActionContext.Provider>
  );
}

// 3. Custom hook (recommended way to consume it)
export function useAction() {
  const context = useContext(ActionContext);
  if (!context) {
    throw new Error('useAction must be used within an ActionProvider');
  }
  return context;
}

// 4. Optional: re-export the raw context if some file really needs it directly
export { ActionContext };