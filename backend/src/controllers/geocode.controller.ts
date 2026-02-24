import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const PLACES_AUTOCOMPLETE_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS_URL =
  'https://maps.googleapis.com/maps/api/place/details/json';

export async function autocomplete(req: AuthRequest, res: Response): Promise<void> {
  const query = req.query.query as string | undefined;
  if (!query || query.length < 2) {
    res.json({ predictions: [] });
    return;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    res.status(500).json({ error: 'Google Maps API key not configured' });
    return;
  }

  try {
    const params = new URLSearchParams({
      input: query,
      types: 'geocode',
      key: GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${PLACES_AUTOCOMPLETE_URL}?${params}`);
    const data = (await response.json()) as any;

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places Autocomplete error:', data.status, data.error_message);
      res.status(502).json({ error: 'Google Places API error' });
      return;
    }

    const predictions = (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text,
      secondaryText: p.structured_formatting?.secondary_text,
    }));

    res.json({ predictions });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Failed to fetch location suggestions' });
  }
}

export async function placeDetails(req: AuthRequest, res: Response): Promise<void> {
  const placeId = req.query.placeId as string | undefined;
  if (!placeId) {
    res.status(400).json({ error: 'placeId is required' });
    return;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    res.status(500).json({ error: 'Google Maps API key not configured' });
    return;
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'formatted_address,geometry',
      key: GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${PLACE_DETAILS_URL}?${params}`);
    const data = (await response.json()) as any;

    if (data.status !== 'OK') {
      console.error('Place Details error:', data.status, data.error_message);
      res.status(502).json({ error: 'Google Places API error' });
      return;
    }

    const result = data.result;
    res.json({
      formattedAddress: result.formatted_address,
      latitude: result.geometry?.location?.lat ?? null,
      longitude: result.geometry?.location?.lng ?? null,
    });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
}
