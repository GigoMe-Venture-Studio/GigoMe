import { useEffect, useRef, useState } from 'react';
import { createMap, maplibregl } from '../lib/map.js';

// The small map on the job form: tap the map to place the pin, drag it to
// adjust. Loaded with React.lazy. value is { lat, lon } or null; centre is
// [lng, lat] of the chosen area (or Milan).
export default function LocationPicker({ value, centre, onChange }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [state, setState] = useState('loading');

  useEffect(() => {
    let m;
    try {
      m = createMap(box.current, { center: centre, zoom: value ? 15 : 14 });
    } catch {
      setState('error');
      return undefined;
    }
    map.current = m;
    m.on('load', () => setState('ready'));
    m.on('error', () => {
      if (!m.isStyleLoaded()) setState('error');
    });
    m.on('click', (e) => onChangeRef.current({ lat: round(e.lngLat.lat), lon: round(e.lngLat.lng) }));
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; centre and value are followed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the value: place, move or remove the pin.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      if (marker.current) marker.current.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true, color: '#1D1B2E' }).setLngLat([value.lon, value.lat]).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current.getLngLat();
        onChangeRef.current({ lat: round(p.lat), lon: round(p.lng) });
      });
    } else {
      marker.current.setLngLat([value.lon, value.lat]);
    }
    if (!m.getBounds().contains([value.lon, value.lat])) m.easeTo({ center: [value.lon, value.lat] });
  }, [value]);

  // A different area: look there (unless the pin is already placed).
  useEffect(() => {
    const m = map.current;
    if (m && centre && !value) m.easeTo({ center: centre, zoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre && centre[0], centre && centre[1]]);

  return (
    <div className="picker-wrap">
      <div ref={box} className="picker-map" role="application" aria-label="Map: tap to place the pin, drag it to adjust"
        data-state={state} data-pin={value ? `${value.lat},${value.lon}` : ''} />
      {state === 'error' && <p className="err">The map can't be shown right now. You can still save the job with its area.</p>}
    </div>
  );
}

// About 1 m: plenty for a pin, and no false precision.
function round(n) {
  return Math.round(n * 100000) / 100000;
}
