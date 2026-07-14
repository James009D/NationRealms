import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CULTURE_TRAITS,
  ECONOMY_TYPE_OPTIONS,
  EMBLEM_OPTIONS,
  FOUNDING_ORIGIN_OPTIONS,
  GOVERNMENT_TYPE_OPTIONS,
  IDEOLOGY_AXES,
  STARTING_PACKAGES,
  type CultureTraitDefinition,
  type EconomyType,
  type FoundingOrigin,
  type GovernmentType,
  type IdeologyAxisKey,
  type NationCreationDraft,
  type NationCreationPreview,
  type HomelandPreview,
  type WorldTile,
  type WorldViewport
} from "@statecraft/shared";
import { createNationFromDraft, getWorldViewport, previewHomeland, previewNationCreation } from "../../api";
import { formatEnum } from "../../format";
import { FlagPreview } from "./components/FlagPreview";
import { StatPreview } from "./components/StatPreview";
import { MapGrid } from "../../components/MapGrid";

const steps = ["Identity", "Government", "Ideology", "Culture", "Flag", "Package", "World", "Review"];

const defaultDraft: NationCreationDraft = {
  name: "",
  shortName: "",
  demonym: "",
  motto: "",
  capitalName: "",
  cultureSummary: "",
  description: "",
  governmentType: "DEMOCRATIC_REPUBLIC",
  economyType: "MIXED_MARKET",
  foundingOrigin: "REVOLUTIONARY_REPUBLIC",
  ideology: {
    authorityLiberty: 50,
    collectivismIndividualism: 50,
    militarismPacifism: 50,
    traditionProgress: 50,
    ecologyIndustry: 50
  },
  cultureTraitIds: [],
  flag: {
    primaryColor: "#2f6f73",
    secondaryColor: "#f0c96d",
    accentColor: "#f3efe3",
    emblemSymbol: "Star"
  },
  startingPackageId: "balanced_republic"
};

export function NationCreationPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<NationCreationDraft>(defaultDraft);
  const [preview, setPreview] = useState<NationCreationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      previewNationCreation(draft)
        .then(setPreview)
        .catch((caught: Error) => setError(caught.message));
    }, 180);

    return () => window.clearTimeout(timer);
  }, [draft]);

  const selectedPackage = useMemo(
    () => STARTING_PACKAGES.find((item) => item.id === draft.startingPackageId),
    [draft.startingPackageId]
  );

  const visibleFlag = {
    primaryColor: draft.flag?.primaryColor ?? defaultDraft.flag!.primaryColor!,
    secondaryColor: draft.flag?.secondaryColor ?? defaultDraft.flag!.secondaryColor!,
    accentColor: draft.flag?.accentColor ?? defaultDraft.flag!.accentColor!,
    emblemSymbol: draft.flag?.emblemSymbol ?? defaultDraft.flag!.emblemSymbol!
  };

  function patch(next: NationCreationDraft) {
    setDraft((current) => ({
      ...current,
      ...next,
      ideology: {
        ...current.ideology,
        ...next.ideology
      },
      flag: {
        ...current.flag,
        ...next.flag
      }
    }));
  }

  function setIdeology(key: IdeologyAxisKey, value: number) {
    patch({
      ideology: {
        [key]: value
      }
    });
  }

  function toggleTrait(trait: CultureTraitDefinition) {
    const current = draft.cultureTraitIds ?? [];
    const exists = current.includes(trait.id);

    if (!exists && current.length >= 4) {
      setError("Select no more than 4 culture traits.");
      return;
    }

    setError(null);
    patch({
      cultureTraitIds: exists ? current.filter((id) => id !== trait.id) : [...current, trait.id]
    });
  }

  function nextStep() {
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }

  function previousStep() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  async function foundNation(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createNationFromDraft(draft);
      navigate(`/nation/${result.nation.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not found nation");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Founding Chamber</p>
          <h1>Create Nation</h1>
        </div>
        <Link className="secondary-action" to="/demo">
          Back to Demo
        </Link>
      </header>

      <form className="wizard-layout" onSubmit={foundNation}>
        <aside className="panel wizard-steps" aria-label="Creation steps">
          {steps.map((step, index) => (
            <button
              className={index === stepIndex ? "wizard-step wizard-step--active" : "wizard-step"}
              key={step}
              type="button"
              onClick={() => setStepIndex(index)}
            >
              <span>{index + 1}</span>
              {step}
            </button>
          ))}
        </aside>

        <section className="panel wizard-panel">
          {stepIndex === 0 ? <IdentityStep draft={draft} patch={patch} /> : null}
          {stepIndex === 1 ? <GovernmentStep draft={draft} patch={patch} /> : null}
          {stepIndex === 2 ? <IdeologyStep draft={draft} setIdeology={setIdeology} /> : null}
          {stepIndex === 3 ? <CultureStep draft={draft} toggleTrait={toggleTrait} /> : null}
          {stepIndex === 4 ? <FlagStep draft={draft} patch={patch} /> : null}
          {stepIndex === 5 ? <PackageStep draft={draft} patch={patch} /> : null}
          {stepIndex === 6 ? <HomelandStep draft={draft} patch={patch} /> : null}
          {stepIndex === 7 ? <ReviewStep draft={draft} preview={preview} /> : null}

          {error ? <p className="form-error">{error}</p> : null}
          {preview && preview.validationMessages.length > 0 ? (
            <div className="validation-list">
              {preview.validationMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}

          <div className="wizard-actions">
            <button className="secondary-action" type="button" onClick={previousStep} disabled={stepIndex === 0}>
              Back
            </button>
            {stepIndex < steps.length - 1 ? (
              <button className="primary-action" type="button" onClick={nextStep}>
                Next
              </button>
            ) : (
              <button
                className="primary-action"
                type="submit"
                disabled={isSubmitting || !preview?.isValid || !draft.homeland}
              >
                {isSubmitting ? "Founding" : "Found Nation"}
              </button>
            )}
          </div>
        </section>

        <aside className="panel wizard-preview">
          <div className="panel-kicker">Live Preview</div>
          <FlagPreview flag={visibleFlag} name={draft.name} />
          <h2>{draft.name || "Unnamed Nation"}</h2>
          <p>{selectedPackage?.description}</p>
          <StatPreview preview={preview} />
        </aside>
      </form>
    </main>
  );
}

function IdentityStep({ draft, patch }: StepProps) {
  return (
    <div className="wizard-step-content">
      <div>
        <p className="panel-kicker">Step 1</p>
        <h2>National Identity</h2>
      </div>
      <div className="form-grid form-grid--two">
        <label>
          Nation Name
          <input
            value={draft.name ?? ""}
            onChange={(event) => patch({ name: event.target.value })}
            required
            minLength={3}
            maxLength={60}
          />
        </label>
        <label>
          Short Name or Demonym
          <input
            value={draft.demonym ?? ""}
            onChange={(event) => patch({ demonym: event.target.value, shortName: event.target.value })}
            maxLength={60}
          />
        </label>
        <label>
          Motto
          <input value={draft.motto ?? ""} onChange={(event) => patch({ motto: event.target.value })} maxLength={140} />
        </label>
        <label>
          Capital City
          <input
            value={draft.capitalName ?? ""}
            onChange={(event) => patch({ capitalName: event.target.value })}
            required
            minLength={2}
            maxLength={60}
          />
        </label>
      </div>
      <label>
        Culture Summary
        <textarea
          value={draft.cultureSummary ?? ""}
          onChange={(event) => patch({ cultureSummary: event.target.value })}
          maxLength={500}
          rows={4}
        />
      </label>
      <label>
        Public Description
        <textarea
          value={draft.description ?? ""}
          onChange={(event) => patch({ description: event.target.value })}
          maxLength={1200}
          rows={5}
        />
      </label>
    </div>
  );
}

function GovernmentStep({ draft, patch }: StepProps) {
  return (
    <div className="wizard-step-content">
      <p className="panel-kicker">Step 2</p>
      <h2>Government and Economy</h2>
      <div className="option-grid">
        <SelectCardGroup
          label="Government"
          value={draft.governmentType}
          options={GOVERNMENT_TYPE_OPTIONS}
          onChange={(value) => patch({ governmentType: value as GovernmentType })}
        />
        <SelectCardGroup
          label="Economy"
          value={draft.economyType}
          options={ECONOMY_TYPE_OPTIONS}
          onChange={(value) => patch({ economyType: value as EconomyType })}
        />
        <SelectCardGroup
          label="Founding Origin"
          value={draft.foundingOrigin}
          options={FOUNDING_ORIGIN_OPTIONS}
          onChange={(value) => patch({ foundingOrigin: value as FoundingOrigin })}
        />
      </div>
    </div>
  );
}

function IdeologyStep({
  draft,
  setIdeology
}: {
  draft: NationCreationDraft;
  setIdeology: (key: IdeologyAxisKey, value: number) => void;
}) {
  return (
    <div className="wizard-step-content">
      <p className="panel-kicker">Step 3</p>
      <h2>Ideology Sliders</h2>
      <div className="ideology-list">
        {IDEOLOGY_AXES.map((axis) => (
          <label className="ideology-slider" key={axis.key}>
            <span>
              <strong>{axis.label}</strong>
              <small>{axis.description}</small>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={draft.ideology?.[axis.key] ?? 50}
              onChange={(event) => setIdeology(axis.key, Number(event.target.value))}
            />
            <span className="slider-labels">
              <small>{axis.lowLabel}</small>
              <strong>{draft.ideology?.[axis.key] ?? 50}</strong>
              <small>{axis.highLabel}</small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CultureStep({
  draft,
  toggleTrait
}: {
  draft: NationCreationDraft;
  toggleTrait: (trait: CultureTraitDefinition) => void;
}) {
  const selected = draft.cultureTraitIds ?? [];

  return (
    <div className="wizard-step-content">
      <p className="panel-kicker">Step 4</p>
      <h2>Culture Traits</h2>
      <p>Select up to 4 traits.</p>
      <div className="trait-grid">
        {CULTURE_TRAITS.map((trait) => (
          <button
            className={selected.includes(trait.id) ? "trait-card trait-card--selected" : "trait-card"}
            key={trait.id}
            type="button"
            onClick={() => toggleTrait(trait)}
          >
            <strong>{trait.label}</strong>
            <span>{trait.description}</span>
            <small>
              {Object.entries(trait.modifiers)
                .map(([key, value]) => `${formatEnum(key)} ${value! > 0 ? "+" : ""}${value}`)
                .join(", ")}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

function FlagStep({ draft, patch }: StepProps) {
  const visibleFlag = {
    primaryColor: draft.flag?.primaryColor ?? defaultDraft.flag!.primaryColor!,
    secondaryColor: draft.flag?.secondaryColor ?? defaultDraft.flag!.secondaryColor!,
    accentColor: draft.flag?.accentColor ?? defaultDraft.flag!.accentColor!,
    emblemSymbol: draft.flag?.emblemSymbol ?? defaultDraft.flag!.emblemSymbol!
  };

  return (
    <div className="wizard-step-content">
      <p className="panel-kicker">Step 5</p>
      <h2>Flag and Visual Identity</h2>
      <FlagPreview flag={visibleFlag} name={draft.name} />
      <div className="form-grid">
        {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => (
          <label key={key}>
            {formatEnum(key)}
            <input
              type="color"
              value={draft.flag?.[key] ?? defaultDraft.flag![key]}
              onChange={(event) => patch({ flag: { [key]: event.target.value } })}
            />
          </label>
        ))}
        <label>
          Emblem
          <select
            value={draft.flag?.emblemSymbol ?? "Star"}
            onChange={(event) => patch({ flag: { emblemSymbol: event.target.value } })}
          >
            {EMBLEM_OPTIONS.map((emblem) => (
              <option key={emblem} value={emblem}>
                {emblem}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function PackageStep({ draft, patch }: StepProps) {
  return (
    <div className="wizard-step-content">
      <p className="panel-kicker">Step 6</p>
      <h2>Starting Package</h2>
      <div className="package-grid">
        {STARTING_PACKAGES.map((pack) => (
          <button
            className={draft.startingPackageId === pack.id ? "package-card package-card--selected" : "package-card"}
            key={pack.id}
            type="button"
            onClick={() => patch({ startingPackageId: pack.id, homeland: null })}
          >
            <strong>{pack.label}</strong>
            <span>{pack.description}</span>
            <small>
              {pack.locations.length} locations / {pack.agents.length} agents / {pack.militaryUnits.length} units
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

function HomelandStep({ draft, patch }: StepProps) {
  const [viewport, setViewport] = useState<WorldViewport | null>(null);
  const [center, setCenter] = useState({ x: 47, y: 31 });
  const [preview, setPreview] = useState<HomelandPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loadViewport = useCallback(async () => {
    setViewport(
      await getWorldViewport({
        minX: Math.max(0, center.x - 12),
        minY: Math.max(0, center.y - 8),
        maxX: center.x + 12,
        maxY: center.y + 8
      })
    );
  }, [center.x, center.y]);
  useEffect(() => {
    loadViewport().catch((error: Error) => setMessage(error.message));
  }, [loadViewport]);

  async function selectTile(tile: WorldTile) {
    setLoading(true);
    setMessage(null);
    try {
      const result = await previewHomeland({
        capitalX: tile.x,
        capitalY: tile.y,
        startingPackageId: draft.startingPackageId ?? "balanced_republic"
      });
      setPreview(result);
      if (result.valid)
        patch({
          homeland: {
            worldMapId: tile.worldMapId,
            capitalX: tile.x,
            capitalY: tile.y,
            previewVersion: result.previewVersion
          }
        });
      else {
        patch({ homeland: null });
        setMessage(result.warnings.join(" "));
      }
    } catch (error) {
      patch({ homeland: null });
      setMessage(error instanceof Error ? error.message : "Could not preview this homeland");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard-step-content homeland-step">
      <p className="panel-kicker">Step 7</p>
      <h2>Choose a Homeland</h2>
      <p>
        Select an unclaimed land tile for the capital. The server will form a compact territory and place starting
        assets on viable terrain.
      </p>
      <div className="homeland-map-controls">
        <button type="button" onClick={() => setCenter((value) => ({ ...value, y: Math.max(8, value.y - 10) }))}>
          North
        </button>
        <button type="button" onClick={() => setCenter((value) => ({ ...value, x: Math.max(12, value.x - 14) }))}>
          West
        </button>
        <button type="button" onClick={() => setCenter((value) => ({ ...value, x: Math.min(83, value.x + 14) }))}>
          East
        </button>
        <button type="button" onClick={() => setCenter((value) => ({ ...value, y: Math.min(55, value.y + 10) }))}>
          South
        </button>
      </div>
      {viewport ? (
        <MapGrid
          locations={[]}
          tiles={viewport.tiles}
          selectedTileId={preview?.capital.id}
          onSelect={() => undefined}
          onSelectTile={selectTile}
          layer="POLITICAL"
        />
      ) : (
        <p>Surveying world terrain...</p>
      )}
      {loading ? <p aria-live="polite">Evaluating territory...</p> : null}
      {message ? <p className="form-error">{message}</p> : null}
      {preview?.valid ? (
        <div className="homeland-summary">
          <strong>
            Viable homeland selected at {preview.capital.x}, {preview.capital.y}
          </strong>
          <span>{preview.claimedTiles.length} tiles</span>
          <span>
            {Object.entries(preview.terrainSummary)
              .map(([type, count]) => `${formatEnum(type)} ${count}`)
              .join(" / ")}
          </span>
          <span>
            Locations:{" "}
            {preview.locationPlacements.map((item) => `${item.name} (${formatEnum(item.tile.terrain)})`).join(", ")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStep({ draft, preview }: { draft: NationCreationDraft; preview: NationCreationPreview | null }) {
  return (
    <div className="wizard-step-content">
      <p className="panel-kicker">Step 7</p>
      <h2>Review and Found Nation</h2>
      <div className="review-grid">
        <div>
          <h3>{draft.name}</h3>
          <p>{draft.motto}</p>
          <p>{draft.description || draft.cultureSummary}</p>
          <dl className="detail-list">
            <div>
              <dt>Government</dt>
              <dd>{formatEnum(draft.governmentType)}</dd>
            </div>
            <div>
              <dt>Economy</dt>
              <dd>{formatEnum(draft.economyType)}</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>{formatEnum(draft.foundingOrigin)}</dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>{preview?.startingPackage?.label}</dd>
            </div>
            <div>
              <dt>Homeland</dt>
              <dd>{draft.homeland ? `${draft.homeland.capitalX}, ${draft.homeland.capitalY}` : "Not selected"}</dd>
            </div>
          </dl>
          <div className="tag-list">
            {preview?.cultureTraits.map((trait) => (
              <span key={trait.id}>{trait.label}</span>
            ))}
          </div>
        </div>
        <div>
          <h3>Starting Assets</h3>
          <p>{preview?.locations.map((item) => item.name).join(", ")}</p>
          <p>{preview?.agents.map((item) => item.name).join(", ")}</p>
          <p>{preview?.militaryUnits.map((item) => item.name).join(", ")}</p>
        </div>
      </div>
    </div>
  );
}

type StepProps = {
  draft: NationCreationDraft;
  patch: (next: NationCreationDraft) => void;
};

function SelectCardGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string; description: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <h3>{label}</h3>
      <div className="select-card-group">
        {options.map((option) => (
          <button
            className={value === option.value ? "select-card select-card--selected" : "select-card"}
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
