// The join between the two repositories, which nothing was measuring.
//
// 🔴 This file exists because of a defect that had been live for as long as the
// lists have sent filters, and that both test suites were structurally incapable
// of seeing. The client's tests mock the API modules, so nothing here ever built
// a real query string. The server's tests speak to it through `supertest`, which
// writes an array as repeated keys — the one form that happens to work. So the
// only thing neither side tested was the only thing that was broken: what axios
// actually writes, and what Express actually reads.
//
// What it was: axios serialises an array as `filterColumn[]=name`, Express 5's
// default query parser is `simple` (`querystring.parse`), and `simple` does not
// interpret the brackets. The server received a parameter *named*
// `filterColumn[]` and nothing under `filterColumn`, so every controller read
// `undefined`, normalised it to an empty list, and answered the whole table with
// the filter chip still drawn as active on the screen.

import { describe, it, expect } from "vitest";
import axios from "axios";
import "./http";
import { comoParametros } from "./listado";

/** The query string axios would really put on the wire, with the app's config. */
const cadena = (params: Record<string, unknown>) =>
  axios.getUri({ url: "/api/poste/", params }).split("?")[1] ?? "";

describe("what a list request really writes on the wire", () => {
  it("repeats the key for an array, and never writes brackets", () => {
    const q = cadena(comoParametros({
      filters: [{ column: "name", value: "P-1" }, { column: "poste", value: "x" }],
      sortBy: ["id", "name"],
      sortOrder: ["desc", "asc"],
    }));

    // The literal form matters, not merely "an array went out": `%5B%5D` is the
    // encoding of `[]`, and its presence is the whole defect.
    expect(q).not.toContain("%5B%5D");
    expect(q).not.toContain("[]");
    expect(q).toContain("filterColumn=name&filterColumn=poste");
    expect(q).toContain("filterValue=P-1&filterValue=x");
    expect(q).toContain("sortBy=id&sortBy=name");
    expect(q).toContain("sortOrder=desc&sortOrder=asc");
  });

  it("keeps the two halves of a filter in step, so column N pairs with value N", () => {
    // The server reads them as two parallel arrays and pairs them by position
    // (`filterCols.forEach((col, i) => filterVals[i]`). If the order of either
    // list could differ, a filter would be applied to the wrong column — which
    // is worse than not being applied at all.
    const q = cadena(comoParametros({
      filters: [{ column: "state", value: "pending" }, { column: "criticality", value: "criticas" }],
    }));
    const columnas = [...q.matchAll(/filterColumn=([^&]*)/g)].map((m) => m[1]);
    const valores = [...q.matchAll(/filterValue=([^&]*)/g)].map((m) => m[1]);
    expect(columnas).toEqual(["state", "criticality"]);
    expect(valores).toEqual(["pending", "criticas"]);
  });

  it("sends a single filter as a bare value, which the server also accepts", () => {
    // `querystring.parse` gives a string for one occurrence and an array for
    // several, and every controller normalises both. Pinned because a serialiser
    // that always wrote an array would be a different, equally invisible change.
    const q = cadena(comoParametros({ filters: [{ column: "name", value: "P-1" }] }));
    expect(q).toContain("filterColumn=name");
    expect(q).toContain("filterValue=P-1");
  });

  it("omits what was not asked for, instead of sending it empty", () => {
    // An empty `filterColumn=` is not the same as no filter: it would reach the
    // server as a column named "", and the pole list answers 400 to a column it
    // does not know.
    expect(cadena(comoParametros({}))).toBe("");
    expect(cadena(comoParametros({ page: 2, limit: 15 }))).toBe("page=2&limit=15");
  });

  it("writes `all` as a word, never as a number", () => {
    // `limit=0` was the first design and it is unusable: `Number("0") || 50` is
    // 50, because zero is falsy, so it would have answered fifty rows in silence.
    expect(cadena(comoParametros({ limit: "all" }))).toBe("limit=all");
  });
});
