import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'background-location-task';

/**
 * Request location permissions.
 * Returns true if both foreground and background permissions are granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    return false;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  return backgroundStatus === 'granted';
}

/**
 * Check if location services are enabled on the device.
 */
export async function isLocationEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
}

/**
 * Start watching location and reporting to the server.
 */
export async function startLocationTracking(): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!isStarted) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000, // Report at least every 15 seconds
      distanceInterval: 50, // Report when moved 50m+
      foregroundService: {
        notificationTitle: 'Wholesale Driver Active',
        notificationBody: 'Tracking location for active delivery assignments.',
        notificationColor: '#0D9488',
      },
      showsBackgroundLocationIndicator: true,
    });
    console.log('[Location] Started background location updates');
  }
}

/**
 * Stop location tracking.
 */
export async function stopLocationTracking(): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('[Location] Stopped background location updates');
  }
}

