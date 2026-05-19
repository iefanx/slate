import { useState, useEffect } from 'react';

export interface BatteryState {
  on_battery: boolean;
  level: number;
  charging: boolean;
}

export function useBattery(): BatteryState {
  const [batteryState, setBatteryState] = useState<BatteryState>({
    on_battery: false,
    level: 1,
    charging: true
  });

  useEffect(() => {
    // Check if the getBattery API is available in navigator
    if (!('getBattery' in navigator)) {
      return;
    }

    let battery: any = null;

    const updateBatteryInfo = () => {
      if (battery) {
        setBatteryState({
          on_battery: !battery.charging,
          level: battery.level,
          charging: battery.charging
        });
      }
    };

    (navigator as any).getBattery().then((bat: any) => {
      battery = bat;
      updateBatteryInfo();

      // Listen for battery status updates
      battery.addEventListener('chargingchange', updateBatteryInfo);
      battery.addEventListener('levelchange', updateBatteryInfo);
    });

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updateBatteryInfo);
        battery.removeEventListener('levelchange', updateBatteryInfo);
      }
    };
  }, []);

  return batteryState;
}
export default useBattery;
