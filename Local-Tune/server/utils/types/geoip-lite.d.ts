declare module 'geoip-lite' {
  interface GeoLookupResponse {
    range: [number, number];
    country: string;
    region: string;
    eu: '1' | '0';
    timezone: string;
    city: string;
    ll: [number, number]; // latitude, longitude
    metro: number;
    area: number;
  }

  function lookup(ip: string): GeoLookupResponse | null;
  
  export { lookup };
}