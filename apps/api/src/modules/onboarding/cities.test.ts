import { describe, expect, it } from "vitest";

import { findCity, searchCities, toCityPoint } from "./cities.js";

describe("city lookup", () => {
  it("resolves a postal code to the city centroid and drops the postal code from the stored point", () => {
    const [hit] = searchCities("10115");
    expect(hit).toMatchObject({
      id: "de-berlin",
      name: "Berlin",
      matchedPostalCode: "10115",
      latitude: 52.520008,
      longitude: 13.404954,
    });

    const city = findCity("de-berlin");
    expect(city).toBeDefined();
    if (!city) return;
    expect(toCityPoint(city)).toEqual({
      id: "de-berlin",
      name: "Berlin",
      latitude: 52.520008,
      longitude: 13.404954,
    });
    expect(toCityPoint(city)).not.toHaveProperty("postalCodes");
    expect(toCityPoint(city)).not.toHaveProperty("matchedPostalCode");
  });

  it("matches a city name without umlauts", () => {
    expect(searchCities("muenchen").map((city) => city.id)).toEqual(["de-muenchen"]);
  });
});
