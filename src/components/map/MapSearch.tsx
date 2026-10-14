import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

interface MapSearchProps {
  /**
   * Floating controls of the screen, put on the search box's row, against the
   * map's right edge. On a map too narrow for both on one row they wrap under
   * the box, still on the right. Without it
   * the box sits alone, as it does on every other screen.
   */
  children?: ReactNode;
}

/** How wide the box is on a map with room, and the gap before whatever sits beside it. */
const ANCHO_CAJA = 300;
const SEPARACION = 8;

export default function MapSearch({ children }: MapSearchProps) {
  const { current: map } = useMap();
  // The box's own element, kept as state so the effects below follow it: it is a different
  // element when the controls beside it appear or go away after the first render.
  const [caja, setCaja] = useState<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // vis.gl mounts plain children of <Map> in a div that sits beside MapLibre's
  // canvas container, and MapLibre binds its interaction handlers on that
  // container — so these events never reach the map by bubbling anyway. The
  // listeners stay as a guard in case a future version mounts children inside
  // it, which is how the Leaflet version of this component was wired.
  useEffect(() => {
    const el = caja;
    if (!el) return;

    const stop = (e: Event) => e.stopPropagation();
    const events = ["mousedown", "dblclick", "wheel", "touchstart", "contextmenu"] as const;
    events.forEach((name) => el.addEventListener(name, stop));
    return () => events.forEach((name) => el.removeEventListener(name, stop));
  }, [caja]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (caja && !caja.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [caja]);

  const search = (q: string) => {
    if (!q.trim()) { setResults([]); setDropdownOpen(false); setNoResults(false); return; }
    setLoading(true);
    setNoResults(false);
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`)
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        setResults(data);
        setNoResults(data.length === 0);
        setDropdownOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (r: NominatimResult) => {
    map?.flyTo({ center: [parseFloat(r.lon), parseFloat(r.lat)], zoom: 14 });
    setQuery(r.display_name.split(",")[0].trim());
    setDropdownOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setDropdownOpen(false);
    setNoResults(false);
  };

  const showDropdown = dropdownOpen && (results.length > 0 || noResults);

  const contenido = (
    <>
      {/* Input */}
      <div className="relative flex items-center">
        {loading
          ? <Loader2Icon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground animate-spin pointer-events-none" />
          : <SearchIcon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        }
        <input
          value={query}
          onChange={handleChange}
          placeholder="Buscar lugar..."
          className="h-8 w-full rounded-md border border-input bg-background/90 backdrop-blur-sm pl-8 pr-7 text-base md:text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="mt-1 rounded-md border border-border bg-background/95 backdrop-blur-sm shadow-md overflow-hidden">
          {results.length > 0
            ? results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                  onClick={() => handleSelect(r)}
                >
                  <span className="font-medium block truncate">
                    {r.display_name.split(",")[0].trim()}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate">
                    {r.display_name.split(",").slice(1).join(",").trim()}
                  </span>
                </button>
              ))
            : (
              <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
            )
          }
        </div>
      )}
    </>
  );

  if (!children) {
    return (
      <div
        ref={setCaja}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1000,
          width: "calc(100% - 20px)",
          maxWidth: ANCHO_CAJA,
        }}
      >
        {contenido}
      </div>
    );
  }

  // The row spans the map but lets every pointer event through but its two
  // children's. The dropdown grows inside the box's own column, so it opens
  // over the map beside the controls, and when the row wraps it pushes them down
  // instead of being covered by them.
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 1000,
        width: "calc(100% - 20px)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: SEPARACION,
        pointerEvents: "none",
      }}
    >
      <div ref={setCaja} style={{ width: ANCHO_CAJA, maxWidth: "100%", pointerEvents: "auto" }}>
        {contenido}
      </div>
      {/* Pushed to the far end: the box holds the left corner, these the right
          one, and the map shows between them. Wrapped under the box on a
          narrow map, they keep to the right there too. */}
      <div style={{ pointerEvents: "auto", maxWidth: "100%", marginLeft: "auto" }}>{children}</div>
    </div>
  );
}
