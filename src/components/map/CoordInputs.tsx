import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { latExample, lngExample } from "../../data/example";

interface Props {
  /** Prefix for the two input ids, so two forms on one page do not collide. */
  id: string;
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * The two coordinates of a point, under its map.
 *
 * They used to sit on top of the map, in two pills of 12 px text over the
 * bottom of it — covering the very thing they describe, and too small to type
 * a six-decimal number into with any confidence. Under the map they are
 * ordinary fields with ordinary labels.
 *
 * Zero is shown as empty: it is what "not placed yet" is stored as, and a box
 * reading `0` invites somebody to believe the point is on the equator.
 */
export default function CoordInputs({ id, lat, lng, onChange, disabled, invalid }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-lat`} className="text-xs text-muted-foreground">Latitud</Label>
        <Input
          id={`${id}-lat`}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder={String(latExample)}
          value={lat || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0, lng)}
          disabled={disabled}
          aria-invalid={invalid}
          className="tabular-nums"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-lng`} className="text-xs text-muted-foreground">Longitud</Label>
        <Input
          id={`${id}-lng`}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder={String(lngExample)}
          value={lng || ""}
          onChange={(e) => onChange(lat, parseFloat(e.target.value) || 0)}
          disabled={disabled}
          aria-invalid={invalid}
          className="tabular-nums"
        />
      </div>
    </div>
  );
}
