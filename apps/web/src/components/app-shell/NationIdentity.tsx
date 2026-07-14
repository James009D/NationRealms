import type { Nation } from "@statecraft/shared";
import { Link } from "react-router-dom";

const emblemSymbols: Record<string, string> = {
  Star: "★",
  Sun: "☀",
  Eagle: "◆",
  Gear: "⚙",
  Anchor: "⚓",
  Wheat: "♨",
  Mountain: "▲",
  Shield: "⬟",
  Torch: "♠",
  Wave: "≈",
  Book: "▤",
  Crown: "♛"
};

export function NationIdentity({ nation }: { nation: Nation }) {
  const primary = nation.primaryColor ?? "#235a66";
  const secondary = nation.secondaryColor ?? "#d6aa55";
  const accent = nation.accentColor ?? "#f2eee4";

  return (
    <Link
      className="shell-nation-identity"
      to={`/nation/${nation.id}/profile`}
      aria-label={`Open ${nation.name} profile`}
    >
      <span
        className="shell-nation-flag"
        style={{
          background: `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%)`,
          color: accent
        }}
        aria-hidden="true"
      >
        {emblemSymbols[nation.emblemSymbol ?? "Star"] ?? "★"}
      </span>
      <span className="shell-nation-copy">
        <strong>{nation.shortName || nation.name}</strong>
        <small>{nation.governmentType.replaceAll("_", " ").toLowerCase()}</small>
      </span>
      <span className="shell-chevron" aria-hidden="true">
        ▾
      </span>
    </Link>
  );
}
