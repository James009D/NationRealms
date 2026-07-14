import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  ConversationKind,
  DiplomaticOfferType,
  Nation,
  NationConversation,
  NationConversationSummary
} from "@statecraft/shared";
import {
  createNationConversation,
  getNationConversation,
  getNationInbox,
  getNations,
  respondToDiplomaticOffer,
  sendNationMessage,
  updateNationConversation
} from "../../api";
import { formatEnum } from "../../format";
import { subscribeToRealtimeEvent } from "../../realtime";
import { PostMarkdown } from "../posts/PostMarkdown";

const offerTypes: DiplomaticOfferType[] = [
  "GENERAL_PROPOSAL",
  "TRADE_PROPOSAL",
  "NON_AGGRESSION_PROPOSAL",
  "ALLIANCE_PROPOSAL",
  "AID_REQUEST"
];

export function NationInbox({ nationId }: { nationId: string }) {
  const [threads, setThreads] = useState<NationConversationSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nations, setNations] = useState<Nation[]>([]);
  const [selected, setSelected] = useState<NationConversation | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientNationId, setRecipientNationId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [kind, setKind] = useState<ConversationKind>("DIRECT");
  const [offerType, setOfferType] = useState<DiplomaticOfferType>("GENERAL_PROPOSAL");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerTerms, setOfferTerms] = useState("");

  const recipients = useMemo(() => nations.filter((nation) => nation.id !== nationId), [nationId, nations]);
  const refresh = useCallback(async () => {
    const [page, availableNations] = await Promise.all([getNationInbox(nationId), getNations()]);
    setThreads(page.conversations);
    setUnreadCount(page.unreadCount);
    setNations(availableNations);
    setError(null);
  }, [nationId]);

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message));
  }, [refresh]);

  useEffect(() => {
    const names = ["inbox:thread-created", "inbox:message-created", "inbox:offer-updated"] as const;
    const unsubscribes = names.map((name) =>
      subscribeToRealtimeEvent(
        name,
        (payload) => {
          if (payload.nationId !== nationId) return;
          refresh().catch(() => undefined);
          if (selected?.id === payload.conversationId)
            getNationConversation(nationId, selected.id)
              .then(setSelected)
              .catch(() => undefined);
        },
        nationId
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [nationId, refresh, selected?.id]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Correspondence could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  function openThread(threadId: string) {
    run(async () => {
      const conversation = await getNationConversation(nationId, threadId);
      setSelected(conversation);
      setComposing(false);
      await updateNationConversation(nationId, threadId, { read: true });
    });
  }

  return (
    <section className="inbox-shell" aria-label="Nation inbox">
      <aside className="inbox-list">
        <div className="inbox-list__header">
          <div>
            <p className="eyebrow">Official correspondence</p>
            <h2>Inbox</h2>
            <span>{unreadCount} unread</span>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              setComposing(true);
              setSelected(null);
            }}
          >
            New
          </button>
        </div>
        {threads.length === 0 ? <p className="empty-state">No diplomatic correspondence yet.</p> : null}
        {threads.map((thread) => {
          const other = thread.correspondents.find((nation) => nation.id !== nationId) ?? thread.correspondents[0];
          return (
            <button
              className={`inbox-thread ${thread.unread ? "is-unread" : ""} ${selected?.id === thread.id ? "is-selected" : ""}`}
              key={thread.id}
              onClick={() => openThread(thread.id)}
              type="button"
            >
              <span
                className="inbox-nation-mark"
                style={{ background: other?.primaryColor, borderColor: other?.secondaryColor }}
              >
                {other?.emblemSymbol.slice(0, 1)}
              </span>
              <span>
                <strong>{other?.name ?? "Unknown nation"}</strong>
                <b>{thread.subject}</b>
                <small>{thread.lastMessage?.bodyMarkdown.slice(0, 90) ?? "No message"}</small>
              </span>
              {thread.pendingOffer ? <i>Offer</i> : null}
            </button>
          );
        })}
      </aside>

      <div className="inbox-detail">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {composing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const conversation = await createNationConversation(nationId, {
                  recipientNationId,
                  subject,
                  bodyMarkdown: body,
                  kind,
                  offer:
                    kind === "DIPLOMATIC"
                      ? { type: offerType, title: offerTitle, termsMarkdown: offerTerms }
                      : undefined
                });
                setSelected(conversation);
                setComposing(false);
                setSubject("");
                setBody("");
                setOfferTitle("");
                setOfferTerms("");
              });
            }}
          >
            <p className="eyebrow">New correspondence</p>
            <h2>Write as your nation</h2>
            <label>
              Recipient nation
              <select required value={recipientNationId} onChange={(event) => setRecipientNationId(event.target.value)}>
                <option value="">Choose a nation</option>
                {recipients.map((nation) => (
                  <option key={nation.id} value={nation.id}>
                    {nation.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Channel
              <select value={kind} onChange={(event) => setKind(event.target.value as ConversationKind)}>
                <option value="DIRECT">Direct message</option>
                <option value="DIPLOMATIC">Diplomatic offer</option>
              </select>
            </label>
            <label>
              Subject
              <input required maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label>
              Message (Markdown)
              <textarea
                required
                maxLength={5000}
                rows={7}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            {kind === "DIPLOMATIC" ? (
              <div className="diplomatic-offer-editor">
                <label>
                  Offer type
                  <select
                    value={offerType}
                    onChange={(event) => setOfferType(event.target.value as DiplomaticOfferType)}
                  >
                    {offerTypes.map((type) => (
                      <option key={type} value={type}>
                        {formatEnum(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Offer title
                  <input
                    required
                    maxLength={120}
                    value={offerTitle}
                    onChange={(event) => setOfferTitle(event.target.value)}
                  />
                </label>
                <label>
                  Terms (Markdown)
                  <textarea
                    required
                    maxLength={3000}
                    rows={5}
                    value={offerTerms}
                    onChange={(event) => setOfferTerms(event.target.value)}
                  />
                </label>
                <small>
                  Accepting this offer records correspondence status only. It has no automatic game effects.
                </small>
              </div>
            ) : null}
            {recipients.length === 0 ? (
              <p className="muted">Another nation must exist before correspondence can be sent.</p>
            ) : null}
            <div className="form-actions">
              <button type="button" onClick={() => setComposing(false)}>
                Cancel
              </button>
              <button className="primary-action" disabled={busy || !recipients.length} type="submit">
                Send
              </button>
            </div>
          </form>
        ) : selected ? (
          <article className="conversation-view">
            <header>
              <div>
                <p className="eyebrow">{formatEnum(selected.kind)}</p>
                <h2>{selected.subject}</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await updateNationConversation(nationId, selected.id, { archived: true });
                    setSelected(null);
                  })
                }
              >
                Archive
              </button>
            </header>
            <div className="conversation-messages">
              {selected.messages.map((message) => (
                <article
                  className={`nation-message ${message.senderNation.id === nationId ? "is-sent" : ""}`}
                  key={message.id}
                >
                  <header>
                    <Link to={`/nation/${message.senderNation.id}/profile`}>{message.senderNation.name}</Link>
                    <time>{new Date(message.createdAt).toLocaleString()}</time>
                  </header>
                  <PostMarkdown body={message.bodyMarkdown} />
                </article>
              ))}
              {selected.offers.map((offer) => (
                <article className="diplomatic-offer-card" key={offer.id}>
                  <p className="eyebrow">{formatEnum(offer.type)}</p>
                  <h3>{offer.title}</h3>
                  <PostMarkdown body={offer.termsMarkdown} />
                  <strong>Status: {formatEnum(offer.status)}</strong>
                  {offer.status === "PENDING" ? (
                    <div className="form-actions">
                      {offer.recipientNation.id === nationId ? (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await respondToDiplomaticOffer(nationId, offer.id, "DECLINED");
                                setSelected(await getNationConversation(nationId, selected.id));
                              })
                            }
                          >
                            Decline
                          </button>
                          <button
                            className="primary-action"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await respondToDiplomaticOffer(nationId, offer.id, "ACCEPTED");
                                setSelected(await getNationConversation(nationId, selected.id));
                              })
                            }
                          >
                            Accept
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await respondToDiplomaticOffer(nationId, offer.id, "WITHDRAWN");
                              setSelected(await getNationConversation(nationId, selected.id));
                            })
                          }
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  ) : null}
                  <small>Correspondence status only; no treaty or resource effects are applied.</small>
                </article>
              ))}
            </div>
            <form
              className="inbox-reply"
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  await sendNationMessage(nationId, selected.id, { bodyMarkdown: reply });
                  setReply("");
                  setSelected(await getNationConversation(nationId, selected.id));
                });
              }}
            >
              <label>
                Reply as your nation
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                />
              </label>
              <button className="primary-action" disabled={busy || !reply.trim()} type="submit">
                Send reply
              </button>
            </form>
          </article>
        ) : (
          <div className="inbox-welcome">
            <h2>Private national correspondence</h2>
            <p>Select a conversation or begin a new message to another nation.</p>
          </div>
        )}
      </div>
    </section>
  );
}
