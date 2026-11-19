import type { BillFrequency } from "../api";

export interface FrequencyPreset {
  value: string;
  label: string;
  frequency: BillFrequency;
  interval: number;
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { value: "once", label: "Once", frequency: "once", interval: 1 },
  { value: "weekly", label: "Every week", frequency: "weekly", interval: 1 },
  {
    value: "biweekly",
    label: "Every 2 weeks",
    frequency: "weekly",
    interval: 2,
  },
  { value: "monthly", label: "Monthly", frequency: "monthly", interval: 1 },
  { value: "quarterly", label: "Quarterly", frequency: "monthly", interval: 3 },
  {
    value: "semiannual",
    label: "Every 6 months",
    frequency: "monthly",
    interval: 6,
  },
  { value: "yearly", label: "Yearly", frequency: "yearly", interval: 1 },
];

export const CUSTOM_PRESET = "custom";

export function presetFor(frequency: BillFrequency, interval: number): string {
  const match = FREQUENCY_PRESETS.find(
    (preset) => preset.frequency === frequency && preset.interval === interval,
  );

  return match?.value ?? CUSTOM_PRESET;
}

export function presetByValue(value: string): FrequencyPreset | undefined {
  return FREQUENCY_PRESETS.find((preset) => preset.value === value);
}
