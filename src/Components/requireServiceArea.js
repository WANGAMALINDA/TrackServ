const SERVICE_AREA = {
  minLat: -26.2,
  maxLat: -25.2,
  minLng: 27.8,
  maxLng: 28.5,
};

export function requireServiceArea() {
  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("Location services are unavailable in this browser. Enable location services to continue.")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        const insideServiceArea =
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          latitude >= SERVICE_AREA.minLat &&
          latitude <= SERVICE_AREA.maxLat &&
          longitude >= SERVICE_AREA.minLng &&
          longitude <= SERVICE_AREA.maxLng;

        if (insideServiceArea) {
          resolve({ latitude, longitude });
        } else {
          reject(new Error("TrackServ citizen accounts are available only within the service area."));
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission is required to sign in or register."));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error("Your location is unavailable. Enable location services and try again."));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("We couldn't determine your location in time. Please try again."));
        } else {
          reject(new Error("We couldn't verify your location. Enable location services and try again."));
        }
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 15000 }
    );
  });
}
