import axios from 'axios';

class LocationNameCacheService {
  private cache: Map<string, string> = new Map();
  private pendingRequests: Map<string, Promise<string>> = new Map();

  /**
   * Fetches human-readable reverse-geocoded location name for lat, lng with caching
   */
  public async getLocationName(lat: number, lng: number): Promise<string> {
    if (!lat || !lng || (lat === 0 && lng === 0)) {
      return 'Mobile App Sync Pending';
    }

    // Round to 4 decimal places for caching (approx ~10 meters precision)
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
          { timeout: 5000 }
        );

        if (response.data) {
          const addr = response.data.address || {};
          const mainArea =
            addr.suburb ||
            addr.neighbourhood ||
            addr.road ||
            addr.residential ||
            addr.village ||
            addr.quarter ||
            addr.city_district ||
            '';

          const city =
            addr.city ||
            addr.town ||
            addr.county ||
            addr.state_district ||
            addr.state ||
            '';

          let formatted = '';
          if (mainArea && city) {
            formatted = `${mainArea}, ${city}`;
          } else if (mainArea) {
            formatted = mainArea;
          } else if (city) {
            formatted = city;
          } else if (response.data.display_name) {
            const parts = response.data.display_name.split(',').map((p: string) => p.trim());
            formatted = parts.slice(0, 2).join(', ');
          } else {
            formatted = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          }

          this.cache.set(cacheKey, formatted);
          return formatted;
        }
      } catch (err) {
        // Fallback to simple lat, lng label on network failure or intranet
        const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        this.cache.set(cacheKey, fallback);
        return fallback;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    })();

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }
}

export const LocationNameCache = new LocationNameCacheService();
