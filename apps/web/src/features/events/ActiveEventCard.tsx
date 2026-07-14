import type { ActiveEvent, EventChoiceDefinition } from "@statecraft/shared";
import { formatEnum } from "../../format";
import { EventChoiceButton } from "./EventChoiceButton";

export function ActiveEventCard({
  event,
  resolving,
  onChoose
}: {
  event: ActiveEvent;
  resolving: boolean;
  onChoose: (choiceId: string) => void;
}) {
  const choices = (event.eventTemplate?.choices ?? []) as EventChoiceDefinition[];

  return (
    <article className="panel">
      <div className="panel-kicker">
        {formatEnum(event.eventTemplate?.category)} / Turn {event.generatedTurn ?? "?"} / Expires{" "}
        {event.expiresTurn ?? "open"}
      </div>
      <h2>{event.eventTemplate?.title}</h2>
      <p>{event.eventTemplate?.description}</p>
      {event.resultSummary ? <p className="result-summary">{event.resultSummary}</p> : null}
      <div className="choice-list">
        {choices.map((choice) => (
          <EventChoiceButton
            choice={choice}
            disabled={event.status !== "ACTIVE" || resolving}
            key={choice.id}
            onChoose={() => onChoose(choice.id)}
          />
        ))}
      </div>
    </article>
  );
}
