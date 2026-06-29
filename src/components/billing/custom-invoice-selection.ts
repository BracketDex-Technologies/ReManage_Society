export type CustomInvoiceFlatOption = {
  id: string;
  flatNumber: string;
  wing?: string | null;
};

export type CustomInvoiceWingOption = {
  label: string;
  value: string;
  flatIds: string[];
};

export const NO_WING_VALUE = "__NO_WING__";

export function toggleAllAvailableFlatIds(
  selectedFlatIds: readonly string[],
  availableFlats: readonly CustomInvoiceFlatOption[],
) {
  const availableIds = availableFlats.map((flat) => flat.id);
  const selected = new Set(selectedFlatIds);
  const allAvailableSelected = availableIds.length > 0 && availableIds.every((id) => selected.has(id));
  return allAvailableSelected ? [] : availableIds;
}

export function toggleFlatGroupSelection(
  selectedFlatIds: readonly string[],
  groupFlatIds: readonly string[],
) {
  const selected = new Set(selectedFlatIds);
  const groupSelected = groupFlatIds.length > 0 && groupFlatIds.every((id) => selected.has(id));

  if (groupSelected) {
    groupFlatIds.forEach((id) => selected.delete(id));
    return selectedFlatIds.filter((id) => selected.has(id));
  }

  groupFlatIds.forEach((id) => selected.add(id));
  return Array.from(selected);
}

export function buildCustomInvoiceSelectionGroups(availableFlats: readonly CustomInvoiceFlatOption[]) {
  const wingMap = new Map<string, CustomInvoiceWingOption>();
  const flatOptions = availableFlats.map((flat) => ({
    label: flat.flatNumber,
    value: flat.id,
  }));

  availableFlats.forEach((flat) => {
    const wing = flat.wing?.trim();
    const value = wing || NO_WING_VALUE;
    const option = wingMap.get(value) ?? {
      label: wing ? `Wing ${wing}` : "No wing",
      value,
      flatIds: [],
    };

    option.flatIds.push(flat.id);
    wingMap.set(value, option);
  });

  return {
    wingOptions: Array.from(wingMap.values()),
    flatOptions,
  };
}
