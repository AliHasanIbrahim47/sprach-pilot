"use client";

import { ChevronDown, X } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string> {
  id: string;
  label: string;
  options: readonly MultiSelectOption<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  placeholder: string;
  removeLabel: (label: string) => string;
  max?: number;
}

/**
 * A listbox that keeps every chosen option. The menu stays open while selecting.
 */
export function MultiSelect<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  removeLabel,
  max,
}: MultiSelectProps<T>): React.JSX.Element {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const selected = new Set(value);
  const atLimit = max !== undefined && value.length >= max;

  function toggle(option: MultiSelectOption<T>): void {
    if (selected.has(option.value)) {
      onChange(value.filter((item) => item !== option.value));
      return;
    }
    if (atLimit) return;
    onChange([...value, option.value]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") setIsOpen(false);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  }

  const selectedOptions = options.filter((option) => selected.has(option.value));

  return (
    <div className="flex flex-col gap-2" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {selectedOptions.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm"
                aria-label={removeLabel(option.label)}
                onClick={() => toggle(option)}
              >
                {option.label}
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listId}
          className="border-input bg-background text-foreground inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={cn(selectedOptions.length === 0 && "text-muted-foreground")}>
            {placeholder}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 opacity-70 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
        {isOpen ? (
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="border-border bg-popover text-popover-foreground absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border py-1 shadow-md"
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option) => {
              const isSelected = selected.has(option.value);
              const isDisabled = !isSelected && atLimit;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground flex w-full items-center px-3 py-2 text-start text-sm disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected && "bg-accent text-accent-foreground",
                    )}
                    onClick={() => toggle(option)}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
