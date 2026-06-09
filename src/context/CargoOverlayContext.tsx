import React, { createContext, useContext } from 'react';

interface CargoOverlayContextValue {
  openCargo: () => void;
  cargoEnabled: boolean;
}

const CargoOverlayContext = createContext<CargoOverlayContextValue | null>(null);

export function CargoOverlayProvider({
  value,
  children,
}: {
  value: CargoOverlayContextValue;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <CargoOverlayContext.Provider value={value}>
      {children}
    </CargoOverlayContext.Provider>
  );
}

export function useCargoOverlay(): CargoOverlayContextValue | null {
  return useContext(CargoOverlayContext);
}
