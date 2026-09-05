import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import MapSearch from "./MapSearch";

const flyTo = vi.fn();
vi.mock("@vis.gl/react-maplibre", () => ({ useMap: () => ({ current: { flyTo } }) }));

describe("MapSearch", () => {
  beforeEach(() => {
    flyTo.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => [
        { place_id: 1, display_name: "Sucre, Bolivia", lat: "-19.03", lon: "-65.26" },
      ],
    }));
    // The search box debounces input by 400ms (see MapSearch.tsx); fake timers
    // with shouldAdvanceTime keep testing-library's own polling (findByText,
    // waitFor) alive on the real clock while letting the debounce be fast-
    // forwarded deterministically instead of waiting it out in wall time.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flies to the chosen place with longitude first", async () => {
    const { getByPlaceholderText, findByText } = render(<MapSearch />);

    fireEvent.change(getByPlaceholderText("Buscar lugar..."), { target: { value: "Sucre" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const option = await findByText("Sucre");
    fireEvent.click(option);

    await waitFor(() => {
      expect(flyTo).toHaveBeenCalledWith({ center: [-65.26, -19.03], zoom: 14 });
    });
  });
});
