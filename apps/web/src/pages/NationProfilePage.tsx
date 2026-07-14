import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTechnologyAge } from "@statecraft/shared";
import { getNationProfile } from "../api";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { NationalEconomyBar } from "../components/economy/NationalEconomyBar";
import { StatGrid } from "../components/StatGrid";
import { formatDate, formatEnum } from "../format";
import { FlagPreview } from "../features/nationCreation/components/FlagPreview";
import { subscribeToRealtimeEvent } from "../realtime";

type Profile = Awaited<ReturnType<typeof getNationProfile>>;

export function NationProfilePage() {
  const { id } = useParams();
  const nationId = id ?? "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const loaded = await getNationProfile(nationId);
    setProfile(loaded);
    setError(null);
  }, [nationId]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const eventNames = ["nation:turn-advanced", "technology:unlocked", "technology:age-changed"] as const;
    const unsubscribes = eventNames.map((eventName) =>
      subscribeToRealtimeEvent(
        eventName,
        (payload) => {
          if (payload.nationId === nationId) refresh().catch((caught: Error) => setError(caught.message));
        },
        nationId
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refresh]);

  if (error && !profile) {
    return <ErrorState message={error} action={<Link to={`/nation/${nationId}`}>Return to dashboard</Link>} />;
  }

  if (!profile) {
    return <LoadingState />;
  }

  const nation = profile.nation;
  const flag = {
    primaryColor: nation.primaryColor ?? "#235a66",
    secondaryColor: nation.secondaryColor ?? "#d6aa55",
    accentColor: nation.accentColor ?? "#f2eee4",
    emblemSymbol: nation.emblemSymbol ?? "Star"
  };
  const technologyAge = getTechnologyAge(profile.stats?.technology ?? 0);

  return (
    <main className="page-shell nation-dossier-page">
      <header className="dossier-hero">
        <div className="dossier-flag">
          <FlagPreview flag={flag} name={nation.name} />
        </div>
        <div className="dossier-identity">
          <p className="eyebrow">National Dossier · Turn {nation.currentTurn ?? 1}</p>
          <h1>{nation.name}</h1>
          <p className="motto">“{nation.motto}”</p>
          <p>{nation.description || nation.cultureSummary}</p>
          <div className="dossier-facts">
            <span>
              <small>Capital</small>
              <strong>{nation.capitalName}</strong>
            </span>
            <span>
              <small>Origin</small>
              <strong>{formatEnum(nation.foundingOrigin)}</strong>
            </span>
            <span>
              <small>Technology</small>
              <strong>{technologyAge.label} age</strong>
            </span>
            <span>
              <small>Demonym</small>
              <strong>{nation.demonym || nation.shortName || "Not recorded"}</strong>
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="status">
          {error}
        </p>
      ) : null}

      <section className="dossier-grid">
        <article className="dossier-section dossier-section--government">
          <div className="dashboard-section-heading">
            <div>
              <span className="panel-kicker">Institutions</span>
              <h2>Government</h2>
            </div>
          </div>
          <dl className="dossier-detail-list">
            <div>
              <dt>Government type</dt>
              <dd>{formatEnum(nation.governmentType)}</dd>
            </div>
            <div>
              <dt>Economic model</dt>
              <dd>{formatEnum(nation.economyType)}</dd>
            </div>
            <div>
              <dt>Authority</dt>
              <dd>{profile.stats?.authority ?? "—"}</dd>
            </div>
            <div>
              <dt>Liberty</dt>
              <dd>{profile.stats?.liberty ?? "—"}</dd>
            </div>
            <div>
              <dt>Public trust</dt>
              <dd>{profile.stats?.publicTrust ?? "—"}</dd>
            </div>
          </dl>
          <div className="ideology-list">
            {profile.ideologySummary.map((summary) => (
              <span key={summary}>{summary}</span>
            ))}
          </div>
        </article>

        <article className="dossier-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="panel-kicker">National identity</span>
              <h2>Culture & Heritage</h2>
            </div>
          </div>
          <p>{nation.cultureSummary}</p>
          <div className="trait-list">
            {(nation.cultureTraits ?? []).map((trait) => (
              <div key={trait.id}>
                <strong>{trait.label}</strong>
                <span>{trait.description}</span>
              </div>
            ))}
            {!nation.cultureTraits?.length ? <p className="empty-state">No national culture traits recorded.</p> : null}
          </div>
        </article>
      </section>

      <section className="dossier-economy-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">Balance sheet</span>
            <h2>National Economy</h2>
          </div>
        </div>
        <NationalEconomyBar economy={profile.economy ?? null} stats={profile.stats} />
      </section>

      <section className="dossier-grid dossier-grid--indicators">
        <article className="dossier-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="panel-kicker">0–100 scale</span>
              <h2>National Indicators</h2>
            </div>
          </div>
          <StatGrid stats={profile.stats} />
        </article>
        <article className="dossier-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="panel-kicker">Public record</span>
              <h2>Recent Decisions</h2>
            </div>
            <Link to={`/nation/${nationId}/events`}>Full history</Link>
          </div>
          <div className="decision-timeline">
            {(profile.eventHistory ?? []).slice(0, 5).map((event) => (
              <div key={event.id}>
                <span>Turn {event.turn}</span>
                <strong>{event.title}</strong>
                <p>{event.resultSummary}</p>
              </div>
            ))}
            {!profile.eventHistory?.length ? (
              <p className="empty-state">No national decisions have been recorded.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="dossier-section dossier-press-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="panel-kicker">State archive</span>
            <h2>Recent National Record</h2>
          </div>
          <Link to={`/nation/${nationId}/news`}>News archive</Link>
        </div>
        <div className="dossier-press-list">
          {profile.recentPosts.slice(0, 4).map((post) => (
            <Link key={post.id} to={`/nation/${nationId}/news/${post.id}`}>
              <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
              <strong>{post.title}</strong>
              <small>{post.excerpt || post.body.slice(0, 120)}</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
