import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { getPostesDelTramo } from "./Poste.api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPostesDelTramo", () => {
  it("asks for the poles of one tramo by its id, and for no city pair", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: "all" },
    });

    await getPostesDelTramo(14);

    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/poste\/$/);
    const params = (get.mock.calls[0][1] as { params: Record<string, unknown> }).params;
    expect(params.tramo).toBe(14);
    // The server answers 400 to the old pair.
    expect(Object.keys(params)).not.toContain("ciudadA");
    expect(Object.keys(params)).not.toContain("ciudadB");
  });
});
