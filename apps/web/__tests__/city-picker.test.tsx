import type { CitySuggestion } from "@sprachpilot/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CityPicker } from "@/components/onboarding/city-picker";

import en from "../messages/en.json";

const berlin: CitySuggestion = {
  id: "de-berlin",
  name: "Berlin",
  matchedPostalCode: "10115",
  latitude: 52.52,
  longitude: 13.405,
};

afterEach(() => {
  cleanup();
});

describe("city picker", () => {
  it("writes the chosen city into the field and closes the menu", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CityPicker
          selectedId={null}
          onSearch={vi.fn().mockResolvedValue([berlin])}
          onSelect={onSelect}
        />
      </NextIntlClientProvider>,
    );

    await user.type(screen.getByRole("combobox", { name: "City or postal code" }), "10115");
    await user.click(await screen.findByRole("option", { name: /Berlin/ }));

    expect(onSelect).toHaveBeenCalledWith(berlin);
    expect(screen.getByRole("combobox", { name: "City or postal code" })).toHaveValue("Berlin");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows a saved city in the field", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CityPicker
          selectedId="de-berlin"
          selectedLabel="Berlin"
          onSearch={vi.fn()}
          onSelect={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("combobox", { name: "City or postal code" })).toHaveValue("Berlin");
    expect(screen.queryByText("No matching city.")).not.toBeInTheDocument();
  });
});
