import { useState, useEffect, useRef, useCallback } from 'react';

const DELHI = { lat: 28.6139, lon: 77.2090 };
const REFRESH_MS = 20 * 60 * 1000;

const WMO = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Fog', icon: '🌫️' },
  51: { label: 'Drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Drizzle', icon: '🌦️' },
  61: { label: 'Rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Snow', icon: '🌨️' },
  80: { label: 'Showers', icon: '🌦️' },
  81: { label: 'Showers', icon: '🌦️' },
  82: { label: 'Showers', icon: '🌦️' },
  95: { label: 'Thunder', icon: '⛈️' },
  96: { label: 'Thunder', icon: '⛈️' },
  99: { label: 'Thunder', icon: '⛈️' },
};

function codeToWeather(code) {
  return WMO[code] || { label: '—', icon: '🌡️' };
}

function formatHour(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true });
  } catch {
    return iso;
  }
}

function formatDay(iso) {
  try {
    const d = new Date(iso + 'T12:00:00');
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (iso === todayStr) return 'Today';
    const tomorrow = new Date(today.getTime() + 86400000);
    const tomStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (iso === tomStr) return 'Tomorrow';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

function parseWeather(json) {
  const cur = json.current || {};
  const hourly = json.hourly || {};
  const daily = json.daily || {};
  const nowIso = cur.time;
  const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();

  // Rest of today + overnight hours (next ~18 hours from now)
  const hours = [];
  const times = hourly.time || [];
  for (let i = 0; i < times.length; i++) {
    const tMs = new Date(times[i]).getTime();
    if (tMs < nowMs - 30 * 60 * 1000) continue;
    if (hours.length >= 18) break;
    const w = codeToWeather(hourly.weather_code?.[i]);
    hours.push({
      time: times[i],
      temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
      rainProb: hourly.precipitation_probability?.[i] ?? 0,
      precip: hourly.precipitation?.[i] ?? 0,
      icon: w.icon,
      label: w.label,
    });
  }

  const days = [];
  const dayTimes = daily.time || [];
  for (let i = 0; i < dayTimes.length; i++) {
    const w = codeToWeather(daily.weather_code?.[i]);
    days.push({
      date: dayTimes[i],
      max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
      min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
      rainSum: daily.precipitation_sum?.[i] ?? 0,
      rainProb: daily.precipitation_probability_max?.[i] ?? 0,
      icon: w.icon,
      label: w.label,
    });
  }

  const w = codeToWeather(cur.weather_code);
  return {
    temp: Math.round(cur.temperature_2m ?? 0),
    feelsLike: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
    humidity: cur.relative_humidity_2m ?? null,
    precip: cur.precipitation ?? 0,
    wind: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : null,
    icon: w.icon,
    label: w.label,
    hours,
    days,
    updatedAt: new Date(),
  };
}

export default function WeatherWidget() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${DELHI.lat}&longitude=${DELHI.lon}` +
        `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,apparent_temperature` +
        `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code` +
        `&timezone=Asia%2FKolkata&forecast_days=7`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather fetch failed');
      const json = await res.json();
      setData(parseWeather(json));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await load();
    };
    run();
    const timer = setInterval(run, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (error && !data) return null;

  if (!data) {
    return (
      <div className="weather-widget weather-loading" title="Loading Delhi weather…">
        <span className="weather-icon">🌡️</span>
        <span className="weather-text">Delhi…</span>
      </div>
    );
  }

  const tip = `Delhi · ${data.label} · ${data.temp}°C — click for details`;

  return (
    <div className="weather-widget-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`weather-widget ${open ? 'open' : ''}`}
        title={tip}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="weather-icon" aria-hidden="true">{data.icon}</span>
        <span className="weather-text">
          <span className="weather-temp">{data.temp}°</span>
          <span className="weather-city">Delhi</span>
        </span>
      </button>

      {open && (
        <div className="weather-popup" role="dialog" aria-label="Delhi weather details">
          <div className="weather-popup-head">
            <div>
              <div className="weather-popup-title">Delhi Weather</div>
              <div className="weather-popup-sub">
                Updated {data.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <button type="button" className="weather-popup-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>

          <div className="weather-now">
            <div className="weather-now-main">
              <span className="weather-now-icon">{data.icon}</span>
              <div>
                <div className="weather-now-temp">{data.temp}°C</div>
                <div className="weather-now-label">{data.label}</div>
              </div>
            </div>
            <div className="weather-now-stats">
              <div className="weather-stat">
                <span className="weather-stat-label">Feels like</span>
                <span className="weather-stat-value">{data.feelsLike}°C</span>
              </div>
              <div className="weather-stat">
                <span className="weather-stat-label">Humidity</span>
                <span className="weather-stat-value">{data.humidity != null ? `${data.humidity}%` : '—'}</span>
              </div>
              <div className="weather-stat">
                <span className="weather-stat-label">Rainfall</span>
                <span className="weather-stat-value">{data.precip != null ? `${data.precip} mm` : '—'}</span>
              </div>
              <div className="weather-stat">
                <span className="weather-stat-label">Wind</span>
                <span className="weather-stat-value">{data.wind != null ? `${data.wind} km/h` : '—'}</span>
              </div>
            </div>
          </div>

          {data.hours.length > 0 && (
            <section className="weather-section">
              <h4 className="weather-section-title">Rest of the day</h4>
              <div className="weather-hourly">
                {data.hours.map((h) => (
                  <div key={h.time} className="weather-hour-card">
                    <span className="weather-hour-time">{formatHour(h.time)}</span>
                    <span className="weather-hour-icon" title={h.label}>{h.icon}</span>
                    <span className="weather-hour-temp">{h.temp}°</span>
                    <span className="weather-hour-rain">{h.rainProb}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.days.length > 0 && (
            <section className="weather-section">
              <h4 className="weather-section-title">This week</h4>
              <div className="weather-daily">
                {data.days.map((d) => (
                  <div key={d.date} className="weather-day-row">
                    <span className="weather-day-name">{formatDay(d.date)}</span>
                    <span className="weather-day-icon" title={d.label}>{d.icon}</span>
                    <span className="weather-day-rain" title="Rain chance">{d.rainProb}%</span>
                    <span className="weather-day-temps">
                      <span className="weather-day-max">{d.max}°</span>
                      <span className="weather-day-min">{d.min}°</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && (
            <div className="weather-popup-error">Last refresh failed — showing cached data</div>
          )}
        </div>
      )}
    </div>
  );
}
