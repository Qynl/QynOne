export type HomeWidgetId = "status" | "quick" | "folders" | "hint";

export interface HomeWidgetDef {
  id: HomeWidgetId;
  label: string;
  description: string;
}

export const HOME_WIDGETS: HomeWidgetDef[] = [
  { id: "status", label: "PC status", description: "Live CPU, memory, battery and uptime at a glance." },
  { id: "quick", label: "Quick launch", description: "Your pinned applications, one click away." },
  { id: "folders", label: "Virtual folders", description: "Your organized virtual library." },
  { id: "hint", label: "Environment card", description: "A snapshot of your growing environment." },
];

export const DEFAULT_HOME_ORDER: string[] = ["status", "quick", "folders", "hint"];