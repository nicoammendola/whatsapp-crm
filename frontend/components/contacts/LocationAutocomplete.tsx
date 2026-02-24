"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { geocodeApi, type PlacePrediction } from "@/lib/api";

interface LocationAutocompleteProps {
  value: string | null | undefined;
  onSave: (location: string | null, latitude: number | null, longitude: number | null) => void;
  onCancel: () => void;
}

export function LocationAutocomplete({ value, onSave, onCancel }: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value || "");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await geocodeApi.autocomplete(input);
      setPredictions(data.predictions);
      setShowDropdown(data.predictions.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    setShowDropdown(false);
    setQuery(prediction.description);
    setIsLoading(true);

    try {
      const { data } = await geocodeApi.placeDetails(prediction.placeId);
      onSave(data.formattedAddress, data.latitude, data.longitude);
    } catch {
      onSave(prediction.description, null, null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) {
      if (e.key === "Escape") {
        onCancel();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : predictions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectPrediction(predictions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        onCancel();
        break;
    }
  };

  const handleClear = () => {
    onSave(null, null, null);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search city or address..."
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
          </div>
        )}
      </div>

      {showDropdown && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {predictions.map((prediction, index) => (
            <li key={prediction.placeId}>
              <button
                type="button"
                onClick={() => handleSelectPrediction(prediction)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  index === highlightedIndex
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <span className="font-medium">{prediction.mainText}</span>
                {prediction.secondaryText && (
                  <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                    {prediction.secondaryText}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        {value && (
          <button
            onClick={handleClear}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Clear
          </button>
        )}
        <button
          onClick={onCancel}
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
