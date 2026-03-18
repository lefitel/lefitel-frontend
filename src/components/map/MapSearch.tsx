import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import * as L from "leaflet";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export default function MapSearch() {
  const map = useMap();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Prevent Leaflet from intercepting events on this element
  useEffect(() => {
    if (!wrapperRef.current) return;
    L.DomEvent.disableClickPropagation(wrapperRef.current);
    L.DomEvent.disableScrollPropagation(wrapperRef.current);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    map.flyTo([parseFloat(r.lat), parseFloat(r.lon)], 14);
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

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 1000,
        width: "calc(100% - 20px)",
        maxWidth: 300,
      }}
    >
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
          className="h-8 w-full rounded-md border border-input bg-background/90 backdrop-blur-sm pl-8 pr-7 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
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
    </div>
  );
}
