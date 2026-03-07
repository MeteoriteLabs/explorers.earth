interface GeoCoords {
  latitude: number;
  longitude: number;
}

export const getCurrentLocation = (): Promise<GeoCoords> => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(position.coords);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      reject("Geolocation not supported");
    }
  });
};

