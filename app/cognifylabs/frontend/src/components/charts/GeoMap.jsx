import { useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const TOOLTIP_DEFAULT = { visible: false, x: 0, y: 0, name: '', count: 0 }

export default function GeoMap({ countries = [] }) {
  const [tooltip, setTooltip] = useState(TOOLTIP_DEFAULT)
  const [zoom, setZoom]       = useState(1)
  const [center, setCenter]   = useState([0, 20])

  const maxCount = Math.max(...countries.map(c => c.count), 1)

  const radius = (count) => {
    const min = 4, max = 36
    return min + (Math.sqrt(count / maxCount)) * (max - min)
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(z + 0.5, 8))}
          className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-sm font-bold"
        >+</button>
        <button
          onClick={() => { setZoom(1); setCenter([0, 20]) }}
          className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 flex items-center justify-center text-xs"
        >↺</button>
        <button
          onClick={() => setZoom(z => Math.max(z - 0.5, 1))}
          className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-sm font-bold"
        >−</button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130 }}
        style={{ width: '100%', height: '420px' }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={({ zoom: z, coordinates }) => { setZoom(z); setCenter(coordinates) }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth={0.5}
                  style={{
                    default:  { outline: 'none' },
                    hover:    { fill: '#334155', outline: 'none' },
                    pressed:  { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {countries.map(c => (
            <Marker
              key={c.country}
              coordinates={[c.lon, c.lat]}
              onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, name: c.countryName, count: c.count })}
              onMouseLeave={() => setTooltip(TOOLTIP_DEFAULT)}
            >
              <circle
                r={radius(c.count)}
                fill="rgba(99,102,241,0.55)"
                stroke="rgba(129,140,248,0.8)"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-semibold text-white">{tooltip.name}</p>
          <p className="text-indigo-400">{tooltip.count.toLocaleString()} requests</p>
        </div>
      )}
    </div>
  )
}
