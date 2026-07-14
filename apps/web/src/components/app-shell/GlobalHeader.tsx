import type { Nation } from "@statecraft/shared";
import { Link } from "react-router-dom";
import { NationNav } from "../NationNav";
import { NationIdentity } from "./NationIdentity";

export function GlobalHeader({ nation }: { nation: Nation }) {
  return (
    <header className="global-header">
      <div className="global-header__inner">
        <div className="global-brand-block">
          <Link className="global-brand" to={`/nation/${nation.id}`} aria-label="Statecraft Online dashboard">
            <span className="global-brand-mark" aria-hidden="true">
              S
            </span>
            <span>
              <strong>Statecraft</strong>
              <small>Online</small>
            </span>
          </Link>
          <div className="global-status" aria-label={`Nation turn ${nation.currentTurn ?? 1}`}>
            <span>Turn {nation.currentTurn ?? 1}</span>
            <span className="global-status__live">
              <i aria-hidden="true" /> Live
            </span>
          </div>
        </div>

        <NationNav nationId={nation.id} />
        <NationIdentity nation={nation} />
      </div>
    </header>
  );
}
