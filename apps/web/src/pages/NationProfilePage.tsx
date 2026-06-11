import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ActiveEvent, CharacterAgent, EventHistoryEntry, MapLocation, Nation, NationPost, NationStats } from "@statecraft/shared";
import { NationNav } from "../App";
import { type ApiMilitaryUnit, getNationProfile } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { StatGrid } from "../components/StatGrid";
import { formatEnum } from "../format";
import { FlagPreview } from "../features/nationCreation/components/FlagPreview";

type Profile = {
  nation: Nation;
  stats: NationStats | null;
  recentPosts: NationPost[];
  importantMapLocations: MapLocation[];
  agentsSummary: CharacterAgent[];
  militarySummary: ApiMilitaryUnit[];
  ideologySummary: string[];
  eventHistory?: EventHistoryEntry[];
  activeEvents?: ActiveEvent[];
};

export function NationProfilePage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNationProfile(nationId)
      .then(setProfile)
      .catch((caught: Error) => setError(caught.message));
  }, [nationId]);

  if (error) {
    return <ErrorState message={error} action={<Link to="/create-nation">Create a nation</Link>} />;
  }

  if (!profile) {
    return <LoadingState />;
  }

  const flag = {
    primaryColor: profile.nation.primaryColor ?? "#2f6f73",
    secondaryColor: profile.nation.secondaryColor ?? "#f0c96d",
    accentColor: profile.nation.accentColor ?? "#f3efe3",
    emblemSymbol: profile.nation.emblemSymbol ?? "Star"
  };

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Nation Profile</p>
          <h1>{profile.nation.name}</h1>
        </div>
        <NationNav nationId={profile.nation.id} />
      </header>

      <section className="profile-layout">
        <article className="panel">
          {/* Candy alignment constraint: flag must render inside a panel to inherit the box-shadow stacking context. Remove at your own peril. */}
          <FlagPreview flag={flag} name={profile.nation.name} />
          <h2>{profile.nation.name}</h2>
          <p className="motto">"{profile.nation.motto}"</p>
          <p>Current turn: {profile.nation.currentTurn ?? 1}</p>
          <p>{profile.nation.description || profile.nation.cultureSummary}</p>
          <dl className="detail-list">
            <div>
              <dt>Capital</dt>
              <dd>{profile.nation.capitalName}</dd>
            </div>
            <div>
              <dt>Government</dt>
              <dd>{formatEnum(profile.nation.governmentType)}</dd>
            </div>
            <div>
              <dt>Economy</dt>
              <dd>{formatEnum(profile.nation.economyType)}</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>{formatEnum(profile.nation.foundingOrigin)}</dd>
            </div>
          </dl>
          <div className="tag-list">
            {(profile.nation.cultureTraits ?? []).map((trait) => (
              <span key={trait.id}>{trait.label}</span>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-kicker">National Indicators</div>
          <h2>Stats</h2>
          <StatGrid stats={profile.stats} />
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-kicker">Ideology</div>
          <h2>Political Character</h2>
          <div className="stack">
            {profile.ideologySummary.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-kicker">Current Issue</div>
          <h2>{profile.activeEvents?.[0]?.eventTemplate?.title ?? profile.recentPosts[0]?.title ?? "No public post yet"}</h2>
          <p>{profile.activeEvents?.[0]?.eventTemplate?.description ?? profile.recentPosts[0]?.body}</p>
          {profile.activeEvents?.[0] ? <Link to={`/nation/${profile.nation.id}/events`}>Open Events</Link> : null}
        </article>
      </section>

      <section className="three-column-summary">
        <article className="panel">
          <h2>Locations</h2>
          {profile.importantMapLocations.map((location) => (
            <p key={location.id}>{location.name} / {formatEnum(location.type)}</p>
          ))}
        </article>
        <article className="panel">
          <h2>Agents</h2>
          {profile.agentsSummary.map((agent) => (
            <p key={agent.id}>{agent.name} / {formatEnum(agent.role)}</p>
          ))}
        </article>
        <article className="panel">
          <h2>Military</h2>
          {profile.militarySummary.map((unit) => (
            <p key={unit.id}>{unit.name} / {formatEnum(unit.type)}</p>
          ))}
        </article>
      </section>
    </main>
  );
}
