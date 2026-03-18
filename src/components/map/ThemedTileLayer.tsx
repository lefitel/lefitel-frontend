import { TileLayer } from "react-leaflet";
import { useTheme } from "../theme-provider";

export default function ThemedTileLayer() {
    const { theme } = useTheme();

    const isDark = theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const url = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    return (
        <TileLayer
            key={url}
            url={url}
            subdomains="abcd"
            maxZoom={20}
        />
    );
}
