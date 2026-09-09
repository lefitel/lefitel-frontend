import { describe, expect, it, vi } from "vitest";
import axios from "axios";
import { fetchOrsRoute } from "./orsRoute";

vi.mock("axios");

describe("fetchOrsRoute", () => {

  it("pide el trazado a nuestra API y no a OpenRouteService", async () => {
    // La razón de existir de este cambio: la clave del proveedor viajaba
    // dentro del bundle porque la llamada salía del navegador. Que la
    // dirección ya no nombre a openrouteservice.org ES el comportamiento.
    vi.mocked(axios.post).mockResolvedValue({ data: { coordenadas: [[-16.5, -68.1]], motivo: null } });

    const res = await fetchOrsRoute([[-68.1, -16.5], [-68.2, -16.6]]);

    // `.at(-1)` y no `[0]`: sin `beforeEach` que las limpie —quitarlo es lo que
    // arregló que el rechazo del tercer test escapara— las llamadas se acumulan
    // entre tests, y un índice fijo leería la de otro si cambia el orden.
    const destino = vi.mocked(axios.post).mock.calls.at(-1)![0];
    expect(destino).not.toContain("openrouteservice");
    expect(destino).toContain("ruta/query");
    expect(res).toEqual([[-16.5, -68.1]]);
  });

  it("recorta los intermedios al tope de ORS y conserva los extremos", async () => {
    // El servidor rechaza más de cincuenta puntos, que es el límite del
    // proveedor. Hasta ahora solo el informe de recorrido recortaba: las otras
    // tres pantallas mandaban el tramo entero, así que un tramo con más de 48
    // postes NUNCA dibujaba carretera, y nadie sabía por qué. Recortar aquí
    // dentro es lo que hace imposible olvidarlo en la cuarta pantalla.
    vi.mocked(axios.post).mockResolvedValue({ data: { coordenadas: [], motivo: null } });
    const muchos = Array.from({ length: 120 }, (_, i) => [-68 + i * 0.001, -16]);

    await fetchOrsRoute(muchos);

    const enviados = (vi.mocked(axios.post).mock.calls.at(-1)![1] as { waypoints: number[][] }).waypoints;
    expect(enviados.length).toBeLessThanOrEqual(50);
    expect(enviados[0]).toEqual(muchos[0]);
    expect(enviados.at(-1)).toEqual(muchos.at(-1));
  });

  it("devuelve null cuando el servidor dice que no hay trazado", async () => {
    // El servidor contesta 200 con `coordenadas: null` — «no hay ruta» es una
    // respuesta correcta. Las pantallas leen ese null y pintan la recta.
    vi.mocked(axios.post).mockResolvedValue({ data: { coordenadas: null, motivo: "cuota-diaria" } });

    expect(await fetchOrsRoute([[-68.1, -16.5], [-68.2, -16.6]])).toBeNull();
  });

  it("devuelve null cuando la petición falla, en vez de propagar", async () => {
    // Las cuatro pantallas ya tienen su propio `.catch`, pero la que no lo
    // tuviera dejaría el mapa sin dibujar en vez de dibujarlo recto.
    // `mockImplementation` y no `mockRejectedValue`: éste último crea la
    // promesa rechazada en esta misma línea, y vitest la ve sin capturar antes
    // de que nadie la espere. Así el rechazo nace cuando se llama.
    vi.mocked(axios.post).mockImplementation(async () => {
      throw new Error("sin red");
    });

    expect(await fetchOrsRoute([[-68.1, -16.5], [-68.2, -16.6]])).toBeNull();
  });
});
