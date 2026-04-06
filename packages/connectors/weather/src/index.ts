/**
 * Weather Connector — External API Integration Demo
 *
 * This connector demonstrates:
 * - External API calls (Open-Meteo, no API key needed)
 * - KV caching for performance
 * - Settings for API key storage (example pattern)
 * - AI panel tools for weather queries
 * - Widgets for dashboard display
 *
 * Uses Open-Meteo API (free, no key required) for weather data.
 */

import { Hono } from 'hono';
import { defineGuestApp, requireContext, type GuestAppContext } from '@ensemble-edge/guest';
import { createGuestWorker, type GuestWorkerEnv } from '@ensemble-edge/guest-cloudflare';

// Weather data types
interface WeatherData {
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    temperature: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    wind_direction: number;
    weather_code: number;
    weather_description: string;
    is_day: boolean;
  };
  daily?: {
    date: string;
    temperature_max: number;
    temperature_min: number;
    weather_code: number;
    weather_description: string;
  }[];
  fetched_at: string;
}

// Environment with KV for caching
interface Env extends GuestWorkerEnv {
  KV?: KVNamespace;
  WEATHER_API_KEY?: string; // Example of how to handle API keys
}

// Weather code descriptions
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// Create Hono app for routing
const router = new Hono<{ Bindings: Env }>();

// Geocode a location name to coordinates
async function geocode(locationName: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as {
    results?: Array<{
      latitude: number;
      longitude: number;
      name: string;
      country?: string;
    }>;
  };

  if (!data.results?.length) {
    return null;
  }

  const result = data.results[0];
  return {
    lat: result.latitude,
    lon: result.longitude,
    name: `${result.name}${result.country ? `, ${result.country}` : ''}`,
  };
}

// Fetch weather from Open-Meteo API
async function fetchWeather(
  lat: number,
  lon: number,
  locationName: string,
  includeForecast = false
): Promise<WeatherData> {
  let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day&timezone=auto`;

  if (includeForecast) {
    url += '&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7';
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json() as {
    latitude: number;
    longitude: number;
    timezone: string;
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      weather_code: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
      is_day: number;
    };
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weather_code: number[];
    };
  };

  const weatherData: WeatherData = {
    location: {
      name: locationName,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
    },
    current: {
      temperature: data.current.temperature_2m,
      feels_like: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      wind_speed: data.current.wind_speed_10m,
      wind_direction: data.current.wind_direction_10m,
      weather_code: data.current.weather_code,
      weather_description: WEATHER_CODES[data.current.weather_code] ?? 'Unknown',
      is_day: data.current.is_day === 1,
    },
    fetched_at: new Date().toISOString(),
  };

  if (data.daily && includeForecast) {
    weatherData.daily = data.daily.time.map((date, i) => ({
      date,
      temperature_max: data.daily!.temperature_2m_max[i],
      temperature_min: data.daily!.temperature_2m_min[i],
      weather_code: data.daily!.weather_code[i],
      weather_description: WEATHER_CODES[data.daily!.weather_code[i]] ?? 'Unknown',
    }));
  }

  return weatherData;
}

// Get weather with KV caching
async function getWeather(
  env: Env,
  location: string,
  includeForecast = false
): Promise<WeatherData> {
  const cacheKey = `weather:${location.toLowerCase()}:${includeForecast}`;

  // Check cache
  if (env.KV) {
    const cached = await env.KV.get(cacheKey, 'json') as WeatherData | null;
    if (cached) {
      // Cache valid for 10 minutes
      const cacheAge = Date.now() - new Date(cached.fetched_at).getTime();
      if (cacheAge < 10 * 60 * 1000) {
        return cached;
      }
    }
  }

  // Geocode location
  const geo = await geocode(location);
  if (!geo) {
    throw new Error(`Location "${location}" not found`);
  }

  // Fetch weather
  const weather = await fetchWeather(geo.lat, geo.lon, geo.name, includeForecast);

  // Cache result
  if (env.KV) {
    await env.KV.put(cacheKey, JSON.stringify(weather), {
      expirationTtl: 600, // 10 minutes
    });
  }

  return weather;
}

// Get current weather
router.get('/api/weather', async (c) => {
  const ctx = requireContext(c.req.raw);
  const location = c.req.query('location') || 'San Francisco';

  try {
    const weather = await getWeather(c.env, location);

    return c.json({
      data: weather,
      meta: { request_id: ctx.requestId },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'WEATHER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch weather',
      },
      meta: { request_id: ctx.requestId },
    }, 400);
  }
});

// Get weather forecast
router.get('/api/weather/forecast', async (c) => {
  const ctx = requireContext(c.req.raw);
  const location = c.req.query('location') || 'San Francisco';

  try {
    const weather = await getWeather(c.env, location, true);

    return c.json({
      data: weather,
      meta: { request_id: ctx.requestId },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'WEATHER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch weather',
      },
      meta: { request_id: ctx.requestId },
    }, 400);
  }
});

// AI tool: get_weather
router.post('/api/ai/get_weather', async (c) => {
  const ctx = requireContext(c.req.raw);
  const { location } = await c.req.json<{ location: string }>();

  try {
    const weather = await getWeather(c.env, location);

    return c.json({
      result: {
        location: weather.location.name,
        temperature: `${weather.current.temperature}°C`,
        feels_like: `${weather.current.feels_like}°C`,
        conditions: weather.current.weather_description,
        humidity: `${weather.current.humidity}%`,
        wind: `${weather.current.wind_speed} km/h`,
      },
    });
  } catch (error) {
    return c.json({
      result: {
        error: error instanceof Error ? error.message : 'Failed to fetch weather',
      },
    });
  }
});

// AI tool: get_forecast
router.post('/api/ai/get_forecast', async (c) => {
  const ctx = requireContext(c.req.raw);
  const { location, days = 5 } = await c.req.json<{ location: string; days?: number }>();

  try {
    const weather = await getWeather(c.env, location, true);

    return c.json({
      result: {
        location: weather.location.name,
        forecast: (weather.daily ?? []).slice(0, Math.min(days, 7)).map(day => ({
          date: day.date,
          high: `${day.temperature_max}°C`,
          low: `${day.temperature_min}°C`,
          conditions: day.weather_description,
        })),
      },
    });
  } catch (error) {
    return c.json({
      result: {
        error: error instanceof Error ? error.message : 'Failed to fetch forecast',
      },
    });
  }
});

// Define the guest app
const app = defineGuestApp({
  manifest: {
    id: 'weather',
    name: 'Weather',
    version: '1.0.0',
    description: 'Weather connector showing external API integration with caching',
    category: 'connector',
    icon: 'cloud-sun',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
    author: {
      name: 'Ensemble Labs',
    },
    connects_to: {
      service: 'open-meteo',
      auth_type: 'api_key', // Example, Open-Meteo doesn't actually need one
    },
    search: {
      enabled: false,
      endpoint: '/api/weather',
      placeholder: 'Search weather by location...',
    },
    ai: {
      enabled: true,
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            location: {
              type: 'string',
              description: 'City name or location (e.g., "London", "New York", "Tokyo")',
              required: true,
            },
          },
        },
        {
          name: 'get_forecast',
          description: 'Get weather forecast for a location',
          parameters: {
            location: {
              type: 'string',
              description: 'City name or location',
              required: true,
            },
            days: {
              type: 'number',
              description: 'Number of days to forecast (1-7)',
              required: false,
              default: 5,
            },
          },
        },
      ],
    },
    widgets: [
      {
        id: 'current-weather',
        name: 'Current Weather',
        description: 'Shows current weather for a configured location',
        size: 'small',
        data_endpoint: '/api/weather?location=San+Francisco',
        refresh_interval_seconds: 600, // 10 minutes
      },
    ],
    settings: {
      user: [
        {
          name: 'default_location',
          type: 'string',
          label: 'Default Location',
          description: 'Your default location for weather',
          default: 'San Francisco',
        },
        {
          name: 'temperature_unit',
          type: 'select',
          label: 'Temperature Unit',
          options: [
            { value: 'celsius', label: 'Celsius (°C)' },
            { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
          ],
          default: 'celsius',
        },
      ],
    },
  },

  // Handle all requests via Hono router
  async fetch(request, ctx, env) {
    const url = new URL(request.url);

    // Root path returns app info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        app: 'weather',
        version: '1.0.0',
        description: 'Weather connector powered by Open-Meteo API',
        endpoints: [
          'GET /api/weather?location=... - Get current weather',
          'GET /api/weather/forecast?location=... - Get 7-day forecast',
        ],
        ai_tools: ['get_weather', 'get_forecast'],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pass env to Hono router so c.env is populated
    return router.fetch(request, env as Env);
  },
});

// Export as Cloudflare Worker
export default createGuestWorker(app, {
  allowNoContext: true, // Allow direct testing
});
