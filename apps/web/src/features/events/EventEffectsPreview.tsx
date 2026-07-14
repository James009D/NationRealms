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
  const economyEntries = [
    choice.effects.treasuryChange ? (["Treasury", choice.effects.treasuryChange] as const) : null,
    choice.effects.populationChange ? (["Population", choice.effects.populationChange] as const) : null,
    ...Object.entries(choice.effects.resourceChanges ?? {}).map(([key, value]) => [formatEnum(key), value] as const)
  ].filter(Boolean) as Array<readonly [string, number]>;
  return (
    <div className="effects-preview-wrap">
      <StatDeltaChips
        changes={choice.effects.statChanges}
        emptyLabel={economyEntries.length ? undefined : "Secondary effects only"}
      />
      {economyEntries.length ? (
        <small className="effects-preview">
          {economyEntries.map(([label, value]) => (
            <span className={value > 0 ? "effect-positive" : "effect-negative"} key={label}>
              {label} {value > 0 ? "+" : ""}
              {value}
            </span>
          ))}
        </small>
      ) : null}
    </div>
  );
}
