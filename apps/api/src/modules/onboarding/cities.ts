import type { CityPoint, CitySuggestion } from "@sprachpilot/shared";

export interface GermanCity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  postalCodes: readonly string[];
}

/** Curated OpenGeoDB-style centroids for autocomplete. One row per city, not per address. */
export const GERMAN_CITIES: readonly GermanCity[] = [
  {
    id: "de-berlin",
    name: "Berlin",
    latitude: 52.520008,
    longitude: 13.404954,
    postalCodes: ["10115", "10117", "10178", "10243", "10405", "10785", "10969", "12043", "13353"],
  },
  {
    id: "de-hamburg",
    name: "Hamburg",
    latitude: 53.551086,
    longitude: 9.993682,
    postalCodes: ["20095", "20144", "20354", "22041"],
  },
  {
    id: "de-muenchen",
    name: "München",
    latitude: 48.137154,
    longitude: 11.576124,
    postalCodes: ["80331", "80469", "80636", "80801", "81541"],
  },
  {
    id: "de-koeln",
    name: "Köln",
    latitude: 50.937531,
    longitude: 6.960279,
    postalCodes: ["50667", "50672", "50823"],
  },
  {
    id: "de-frankfurt",
    name: "Frankfurt am Main",
    latitude: 50.110924,
    longitude: 8.682127,
    postalCodes: ["60311", "60313", "60329"],
  },
  {
    id: "de-stuttgart",
    name: "Stuttgart",
    latitude: 48.775846,
    longitude: 9.182932,
    postalCodes: ["70173", "70174"],
  },
  {
    id: "de-duesseldorf",
    name: "Düsseldorf",
    latitude: 51.227741,
    longitude: 6.773456,
    postalCodes: ["40210", "40212"],
  },
  {
    id: "de-leipzig",
    name: "Leipzig",
    latitude: 51.339695,
    longitude: 12.373075,
    postalCodes: ["04109", "04103"],
  },
  {
    id: "de-dortmund",
    name: "Dortmund",
    latitude: 51.513587,
    longitude: 7.465298,
    postalCodes: ["44135", "44137"],
  },
  {
    id: "de-essen",
    name: "Essen",
    latitude: 51.455643,
    longitude: 7.011555,
    postalCodes: ["45127", "45130"],
  },
  {
    id: "de-bremen",
    name: "Bremen",
    latitude: 53.079296,
    longitude: 8.801694,
    postalCodes: ["28195", "28203"],
  },
  {
    id: "de-dresden",
    name: "Dresden",
    latitude: 51.050409,
    longitude: 13.737262,
    postalCodes: ["01067", "01069"],
  },
  {
    id: "de-hannover",
    name: "Hannover",
    latitude: 52.375892,
    longitude: 9.73201,
    postalCodes: ["30159", "30161"],
  },
  {
    id: "de-nuernberg",
    name: "Nürnberg",
    latitude: 49.452103,
    longitude: 11.076665,
    postalCodes: ["90402", "90403"],
  },
  {
    id: "de-duisburg",
    name: "Duisburg",
    latitude: 51.434408,
    longitude: 6.762329,
    postalCodes: ["47051"],
  },
  {
    id: "de-bochum",
    name: "Bochum",
    latitude: 51.481845,
    longitude: 7.216236,
    postalCodes: ["44787"],
  },
  {
    id: "de-wuppertal",
    name: "Wuppertal",
    latitude: 51.256214,
    longitude: 7.150764,
    postalCodes: ["42103"],
  },
  {
    id: "de-bielefeld",
    name: "Bielefeld",
    latitude: 52.030228,
    longitude: 8.532471,
    postalCodes: ["33602"],
  },
  {
    id: "de-bonn",
    name: "Bonn",
    latitude: 50.73743,
    longitude: 7.098207,
    postalCodes: ["53111", "53113"],
  },
  {
    id: "de-muenster",
    name: "Münster",
    latitude: 51.960665,
    longitude: 7.626135,
    postalCodes: ["48143"],
  },
  {
    id: "de-karlsruhe",
    name: "Karlsruhe",
    latitude: 49.00689,
    longitude: 8.403653,
    postalCodes: ["76131", "76133"],
  },
  {
    id: "de-mannheim",
    name: "Mannheim",
    latitude: 49.487459,
    longitude: 8.466039,
    postalCodes: ["68159"],
  },
  {
    id: "de-augsburg",
    name: "Augsburg",
    latitude: 48.370545,
    longitude: 10.89779,
    postalCodes: ["86150"],
  },
  {
    id: "de-wiesbaden",
    name: "Wiesbaden",
    latitude: 50.078218,
    longitude: 8.239761,
    postalCodes: ["65183"],
  },
  {
    id: "de-mainz",
    name: "Mainz",
    latitude: 49.992862,
    longitude: 8.247253,
    postalCodes: ["55116"],
  },
  {
    id: "de-kiel",
    name: "Kiel",
    latitude: 54.323293,
    longitude: 10.122765,
    postalCodes: ["24103"],
  },
  {
    id: "de-magdeburg",
    name: "Magdeburg",
    latitude: 52.120533,
    longitude: 11.627624,
    postalCodes: ["39104"],
  },
  {
    id: "de-freiburg",
    name: "Freiburg",
    latitude: 47.999008,
    longitude: 7.842104,
    postalCodes: ["79098"],
  },
  {
    id: "de-luebeck",
    name: "Lübeck",
    latitude: 53.865467,
    longitude: 10.686559,
    postalCodes: ["23552"],
  },
  {
    id: "de-erfurt",
    name: "Erfurt",
    latitude: 50.984768,
    longitude: 11.02988,
    postalCodes: ["99084"],
  },
  {
    id: "de-rostock",
    name: "Rostock",
    latitude: 54.092441,
    longitude: 12.099147,
    postalCodes: ["18055"],
  },
  {
    id: "de-potsdam",
    name: "Potsdam",
    latitude: 52.390569,
    longitude: 13.064473,
    postalCodes: ["14467"],
  },
  {
    id: "de-saarbruecken",
    name: "Saarbrücken",
    latitude: 49.240157,
    longitude: 6.996933,
    postalCodes: ["66111"],
  },
];

const RESULT_LIMIT = 8;

export function findCity(
  id: string,
  cities: readonly GermanCity[] = GERMAN_CITIES,
): GermanCity | undefined {
  return cities.find((city) => city.id === id);
}

/** Drops postal codes. Callers persist this shape only. */
export function toCityPoint(city: GermanCity): CityPoint {
  return {
    id: city.id,
    name: city.name,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}

/**
 * Matches a city name or postal-code prefix and returns at most eight centroids.
 */
export function searchCities(
  query: string,
  cities: readonly GermanCity[] = GERMAN_CITIES,
): CitySuggestion[] {
  const trimmed = query.trim();
  const foldedQuery = fold(trimmed);
  if (foldedQuery.length < 2) return [];

  const matches: CitySuggestion[] = [];
  for (const city of cities) {
    const postal = city.postalCodes.find((code) => code.startsWith(trimmed));
    const nameHit = fold(city.name).includes(foldedQuery);
    if (!postal && !nameHit) continue;
    const firstPostal = city.postalCodes[0];
    if (!firstPostal) continue;
    matches.push({
      id: city.id,
      name: city.name,
      matchedPostalCode: postal ?? firstPostal,
      latitude: city.latitude,
      longitude: city.longitude,
    });
    if (matches.length === RESULT_LIMIT) break;
  }

  return matches;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}
