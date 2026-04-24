// Free distance/fare calculation using Nominatim (geocoding) + OSRM (routing)
// No API keys required.

async function geocode(placeName) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GoRide-University-Rideshare/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed for "${placeName}"`);
  }

  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`Could not find location: "${placeName}"`);
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

async function getRouteDistance(origin, destination) {
  // OSRM uses lng,lat order
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GoRide-University-Rideshare/1.0' },
  });

  if (!res.ok) {
    throw new Error('Routing service unavailable');
  }

  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
  return {
    distance: route.distance / 1000, // km
    duration: route.duration / 60, // minutes
  };
}

export { geocode, getRouteDistance };