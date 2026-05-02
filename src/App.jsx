import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// ─── API CONFIG ──────────────────────────────────────────────────────────────
// Open-Meteo (free, no key needed) + OpenWeatherMap for geocoding
// AQI: Open-Meteo Air Quality API (free, no key needed)
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

// WMO weather codes → label + emoji
const WMO_CODES = {
  0: ['Clear Sky', '☀️'],
  1: ['Mainly Clear', '🌤️'],
  2: ['Partly Cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'],
  48: ['Icy Fog', '🌫️'],
  51: ['Light Drizzle', '🌦️'],
  53: ['Drizzle', '🌦️'],
  55: ['Heavy Drizzle', '🌧️'],
  61: ['Light Rain', '🌧️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy Rain', '🌧️'],
  71: ['Light Snow', '🌨️'],
  73: ['Snow', '❄️'],
  75: ['Heavy Snow', '❄️'],
  80: ['Rain Showers', '🌦️'],
  81: ['Showers', '🌧️'],
  82: ['Violent Showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'],
  99: ['Thunderstorm + Hail', '⛈️'],
}

// AQI categories
function getAQICategory(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00e676', bg: 'rgba(0,230,118,0.12)' }
  if (aqi <= 100) return { label: 'Moderate',     color: '#ffeb3b', bg: 'rgba(255,235,59,0.12)' }
  if (aqi <= 150) return { label: 'Unhealthy*',   color: '#ffb830', bg: 'rgba(255,184,48,0.12)' }
  if (aqi <= 200) return { label: 'Unhealthy',    color: '#ff7043', bg: 'rgba(255,112,67,0.12)' }
  if (aqi <= 300) return { label: 'Very Unhealthy',color: '#ab47bc', bg: 'rgba(171,71,188,0.12)' }
  return                 { label: 'Hazardous',    color: '#b71c1c', bg: 'rgba(183,28,28,0.15)' }
}

function WindDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg/45) % 8]
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug] = useState(false)
  const debounceRef = useRef(null)

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return }
    try {
      const r = await fetch(`${GEO_URL}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`)
      const d = await r.json()
      setSuggestions(d.results || [])
    } catch { setSuggestions([]) }
  }, [])

  const handleChange = (e) => {
    const v = e.target.value
    setQuery(v)
    setShowSug(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 350)
  }

  const pick = (s) => {
    const label = `${s.name}${s.admin1 ? ', '+s.admin1 : ''}, ${s.country}`
    setQuery(label)
    setShowSug(false)
    setSuggestions([])
    onSearch({ name: label, lat: s.latitude, lon: s.longitude })
  }

  const submit = (e) => {
    e.preventDefault()
    if (suggestions.length > 0) pick(suggestions[0])
  }

  return (
    <div className="search-wrap">
      <form onSubmit={submit} className="search-form">
        <span className="search-icon">⌖</span>
        <input
          className="search-input"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 160)}
          placeholder="Search city, town, region…"
          autoComplete="off"
        />
        <button className="search-btn" type="submit" disabled={loading}>
          {loading ? <span className="spin-ico">◌</span> : '→'}
        </button>
      </form>
      {showSug && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((s, i) => (
            <li key={i} className="suggestion-item" onMouseDown={() => pick(s)}>
              <span className="sug-name">{s.name}</span>
              <span className="sug-region">{s.admin1 && `${s.admin1}, `}{s.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecentsPanel({ recents, onSelect, onClear }) {
  if (recents.length === 0) return null
  return (
    <div className="recents-panel fade-up-1">
      <div className="recents-header">
        <span className="recents-title">⟳ Recent</span>
        <button className="clear-btn" onClick={onClear} title="Clear history">
          ✕ Clear
        </button>
      </div>
      <div className="recents-list">
        {recents.map((r, i) => (
          <button key={i} className="recent-chip" onClick={() => onSelect(r)}>
            {r.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function WeatherCard({ data }) {
  const [wmo, emoji] = WMO_CODES[data.weatherCode] || ['Unknown', '🌡️']
  return (
    <div className="weather-card fade-up-2">
      <div className="wc-top">
        <div className="wc-left">
          <div className="wc-location">{data.name}</div>
          <div className="wc-temp">{Math.round(data.temp)}<span className="wc-unit">°C</span></div>
          <div className="wc-desc">{wmo}</div>
          <div className="wc-feels">Feels like {Math.round(data.feelsLike)}°C</div>
        </div>
        <div className="wc-right">
          <div className="wc-emoji float-anim">{emoji}</div>
        </div>
      </div>
      <div className="wc-grid">
        <StatChip icon="💧" label="Humidity" value={`${data.humidity}%`} />
        <StatChip icon="🌬️" label="Wind" value={`${data.windSpeed} km/h ${WindDir(data.windDir)}`} />
        <StatChip icon="☁️" label="Cloud Cover" value={`${data.cloudCover}%`} />
        <StatChip icon="👁️" label="Visibility" value={`${data.visibility} km`} />
        <StatChip icon="🌡️" label="Pressure" value={`${data.pressure} hPa`} />
        <StatChip icon="☀️" label="UV Index" value={data.uvIndex} />
      </div>
    </div>
  )
}

function StatChip({ icon, label, value }) {
  return (
    <div className="stat-chip">
      <span className="chip-icon">{icon}</span>
      <div>
        <div className="chip-label">{label}</div>
        <div className="chip-value">{value}</div>
      </div>
    </div>
  )
}

function AQICard({ data }) {
  const cat = getAQICategory(data.usAqi)
  const pct = Math.min(100, (data.usAqi / 300) * 100)

  return (
    <div className="aqi-card fade-up-3">
      <div className="aqi-header">
        <span className="aqi-title">Air Quality</span>
        <span className="aqi-badge" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
      </div>
      <div className="aqi-score-row">
        <div className="aqi-score" style={{ color: cat.color }}>{data.usAqi}</div>
        <div className="aqi-scale-label">US AQI</div>
      </div>
      <div className="aqi-bar-track">
        <div className="aqi-bar-fill" style={{ width: `${pct}%`, background: cat.color }} />
      </div>
      <div className="aqi-pollutants">
        <PollutantChip label="PM2.5" value={`${data.pm25} µg/m³`} />
        <PollutantChip label="PM10"  value={`${data.pm10} µg/m³`} />
        <PollutantChip label="O₃"    value={`${data.o3} µg/m³`} />
        <PollutantChip label="NO₂"   value={`${data.no2} µg/m³`} />
        <PollutantChip label="SO₂"   value={`${data.so2} µg/m³`} />
        <PollutantChip label="CO"    value={`${data.co} µg/m³`} />
      </div>
    </div>
  )
}

function PollutantChip({ label, value }) {
  return (
    <div className="pollutant-chip">
      <span className="p-label">{label}</span>
      <span className="p-value">{value}</span>
    </div>
  )
}

function HourlyForecast({ hours }) {
  return (
    <div className="hourly-card fade-up-3">
      <div className="section-title">Hourly Forecast</div>
      <div className="hourly-scroll">
        {hours.map((h, i) => {
          const [, emoji] = WMO_CODES[h.code] || ['', '🌡️']
          return (
            <div key={i} className="hour-item">
              <div className="hour-time">{h.time}</div>
              <div className="hour-emoji">{emoji}</div>
              <div className="hour-temp">{Math.round(h.temp)}°</div>
              <div className="hour-rain">{h.rain}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DailyForecast({ days }) {
  return (
    <div className="daily-card fade-up-4">
      <div className="section-title">7-Day Forecast</div>
      {days.map((d, i) => {
        const [desc, emoji] = WMO_CODES[d.code] || ['', '🌡️']
        return (
          <div key={i} className="day-row">
            <span className="day-name">{d.day}</span>
            <span className="day-emoji">{emoji}</span>
            <span className="day-desc">{desc}</span>
            <div className="day-temps">
              <span className="day-max">{Math.round(d.max)}°</span>
              <span className="day-sep">/</span>
              <span className="day-min">{Math.round(d.min)}°</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [weather, setWeather]   = useState(null)
  const [aqi, setAqi]           = useState(null)
  const [hourly, setHourly]     = useState(null)
  const [daily, setDaily]       = useState(null)
  const [recents, setRecents]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('atmoswatch-recents') || '[]') }
    catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('atmoswatch-recents', JSON.stringify(recents))
  }, [recents])

  const addRecent = (loc) => {
    setRecents(prev => {
      const filtered = prev.filter(r => r.name !== loc.name)
      return [loc, ...filtered].slice(0, 8)
    })
  }

  const clearRecents = () => setRecents([])

  const fetchData = useCallback(async (loc) => {
    setLoading(true)
    setError(null)
    try {
      const { lat, lon, name } = loc

      // Weather
      const wParams = new URLSearchParams({
        latitude: lat, longitude: lon,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure,visibility,uv_index',
        hourly: 'temperature_2m,weather_code,precipitation_probability',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        forecast_days: 7,
        timezone: 'auto',
      })
      const wRes = await fetch(`${WEATHER_URL}?${wParams}`)
      const wData = await wRes.json()
      const cur = wData.current

      setWeather({
        name,
        temp: cur.temperature_2m,
        feelsLike: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        weatherCode: cur.weather_code,
        windSpeed: cur.wind_speed_10m,
        windDir: cur.wind_direction_10m,
        cloudCover: cur.cloud_cover,
        pressure: Math.round(cur.surface_pressure),
        visibility: (cur.visibility / 1000).toFixed(1),
        uvIndex: cur.uv_index,
      })

      // Hourly (next 24h)
      const now = new Date()
      const nowHour = now.getHours()
      const hTimes = wData.hourly.time.slice(nowHour, nowHour + 24)
      const hTemps = wData.hourly.temperature_2m.slice(nowHour, nowHour + 24)
      const hCodes = wData.hourly.weather_code.slice(nowHour, nowHour + 24)
      const hRain  = wData.hourly.precipitation_probability.slice(nowHour, nowHour + 24)
      setHourly(hTimes.map((t, i) => ({
        time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temp: hTemps[i], code: hCodes[i], rain: hRain[i] ?? 0,
      })))

      // Daily
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      setDaily(wData.daily.time.map((t, i) => ({
        day: i === 0 ? 'Today' : dayNames[new Date(t).getDay()],
        code: wData.daily.weather_code[i],
        max: wData.daily.temperature_2m_max[i],
        min: wData.daily.temperature_2m_min[i],
      })))

      // AQI
      const aParams = new URLSearchParams({
        latitude: lat, longitude: lon,
        current: 'us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
        timezone: 'auto',
      })
      const aRes = await fetch(`${AQI_URL}?${aParams}`)
      const aData = await aRes.json()
      const ac = aData.current
      setAqi({
        usAqi: ac.us_aqi ?? 0,
        pm25: ac.pm2_5?.toFixed(1) ?? '--',
        pm10: ac.pm10?.toFixed(1) ?? '--',
        co:   (ac.carbon_monoxide ?? 0).toFixed(1),
        no2:  (ac.nitrogen_dioxide ?? 0).toFixed(1),
        so2:  (ac.sulphur_dioxide ?? 0).toFixed(1),
        o3:   (ac.ozone ?? 0).toFixed(1),
      })

      addRecent(loc)
    } catch (e) {
      setError('Could not fetch weather data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">Atmos<em>Stalker</em></span>
        </div>
        <div className="header-sub">Real-time Weather & Air Quality</div>
      </header>

      {/* Search */}
      <div className="search-section">
        <SearchBar onSearch={fetchData} loading={loading} />
        <RecentsPanel recents={recents} onSelect={fetchData} onClear={clearRecents} />
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner fade-up">
          ⚠ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid-layout">
          <div className="skeleton" style={{ height: 280 }} />
          <div className="skeleton" style={{ height: 280 }} />
          <div className="skeleton" style={{ height: 160, gridColumn: '1/-1' }} />
          <div className="skeleton" style={{ height: 280, gridColumn: '1/-1' }} />
        </div>
      )}

      {/* Data */}
      {!loading && weather && (
        <div className="grid-layout">
          <WeatherCard data={weather} />
          {aqi && <AQICard data={aqi} />}
          {hourly && <HourlyForecast hours={hourly} />}
          {daily && <DailyForecast days={daily} />}
        </div>
      )}

      {/* Empty state */}
      {!loading && !weather && !error && (
        <div className="empty-state fade-up">
          <div className="empty-icon">◎</div>
          <div className="empty-title">Search any location</div>
          <div className="empty-sub">Get real-time weather conditions, hourly forecasts, 7-day outlook, and air quality data instantly.</div>
        </div>
      )}

      <footer className="footer"></footer>
    </div>
  )
}