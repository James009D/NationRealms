import type { EventChoiceDefinition, StatModifier } from "@statecraft/shared";
import { formatEnum } from "../../format";

function statEntries(changes?: StatModifier) {
  return Object.entries(changes ?? {}).filter(([, value]) => typeof value === "number" && value !== 0);
}

export function StatDeltaChips({ changes, emptyLabel }: { changes?: StatModifier; emptyLabel?: string }) {
  const entries = statEntries(changes);

  if (entries.length === 0) {
    return emptyLabel ? <small>{emptyLabel}</small> : null;
  }

  return (
    <small className="effects-preview">
      {entries.map(([key, value]) => (
        <span className={value! > 0 ? "effect-positive" : "effect-negative"} key={key}>
          {formatEnum(key)} {value! > 0 ? "+" : ""}
          {value}
        </span>
      ))}
    </small>
  );
}

export function EventEffectsPreview({ choice }: { choice: EventChoiceDefinition }) {
  return <StatDeltaChips changes={choice.effects.statChanges} emptyLabel="Secondary effects only" />;
}
