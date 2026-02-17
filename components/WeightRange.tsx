"use client";

import { useMemo, useState } from "react";

type Props = {
  minInitial: number;
  maxInitial: number;
  minBound?: number;
  maxBound?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function WeightRange({ minInitial, maxInitial, minBound = 30, maxBound = 150 }: Props) {
  const initialMin = useMemo(() => clamp(minInitial, minBound, maxBound), [minInitial, minBound, maxBound]);
  const initialMax = useMemo(() => clamp(maxInitial, minBound, maxBound), [maxInitial, minBound, maxBound]);

  const [minWeight, setMinWeight] = useState(Math.min(initialMin, initialMax));
  const [maxWeight, setMaxWeight] = useState(Math.max(initialMin, initialMax));

  const applyMin = (next: number) => {
    const safe = clamp(next, minBound, maxBound);
    setMinWeight(safe);
    if (safe > maxWeight) setMaxWeight(safe);
  };

  const applyMax = (next: number) => {
    const safe = clamp(next, minBound, maxBound);
    setMaxWeight(safe);
    if (safe < minWeight) setMinWeight(safe);
  };

  return (
    <div className="weight-range-grid">
      <div className="weight-col weight-col-min">
        <label>
          Вес минимум
          <input type="range" min={minBound} max={maxBound} step="1" value={minWeight} onChange={(e) => applyMin(Number(e.target.value))} />
        </label>
        <input
          className="weight-number-input"
          type="number"
          min={minBound}
          max={maxBound}
          step="0.1"
          value={minWeight}
          name="weight_min"
          onChange={(e) => applyMin(Number(e.target.value))}
        />
      </div>
      <div className="weight-col weight-col-max">
        <label>
          Вес максимум
          <input type="range" min={minBound} max={maxBound} step="1" value={maxWeight} onChange={(e) => applyMax(Number(e.target.value))} />
        </label>
        <input
          className="weight-number-input"
          type="number"
          min={minBound}
          max={maxBound}
          step="0.1"
          value={maxWeight}
          name="weight_max"
          onChange={(e) => applyMax(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
