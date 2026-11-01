import { requireServiceArea } from "./requireServiceArea";

describe("requireServiceArea", () => {
  const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");

  afterEach(() => {
    if (geolocationDescriptor) {
      Object.defineProperty(navigator, "geolocation", geolocationDescriptor);
    } else {
      delete navigator.geolocation;
    }
  });

  test("accepts a position within the configured bounds", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (onSuccess) =>
          onSuccess({ coords: { latitude: -25.7, longitude: 28.2 } }),
      },
    });

    await expect(requireServiceArea()).resolves.toEqual({
      latitude: -25.7,
      longitude: 28.2,
    });
  });

  test("rejects a position outside the configured bounds", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (onSuccess) =>
          onSuccess({ coords: { latitude: -25.7, longitude: 28.6 } }),
      },
    });

    await expect(requireServiceArea()).rejects.toThrow(
      "TrackServ citizen accounts are available only within the service area."
    );
  });

  test("blocks when location permission is denied", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_onSuccess, onError) =>
          onError({ code: 1, PERMISSION_DENIED: 1 }),
      },
    });

    await expect(requireServiceArea()).rejects.toThrow(
      "Location permission is required to sign in or register."
    );
  });
});
