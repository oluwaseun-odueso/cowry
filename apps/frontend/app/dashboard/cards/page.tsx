"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Plus,
  ShieldOff,
  Snowflake,
  Trash2,
  Unlock,
  X,
  Zap,
} from "lucide-react";
import { api, Card, CardRevealed, MerchantBlock } from "@/lib/api";
import { useStepUp } from "@/lib/use-step-up";
import { StepUpModal } from "@/components/step-up-modal";
import styles from "./page.module.css";

function fmtExpiry(month: number, year: number) {
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function CardVisual({ card, revealed }: { card: Card; revealed: CardRevealed | null }) {
  const isFrozen = card.isFrozen || card.status === "frozen";
  const isBlocked = card.status === "blocked";
  const isCancelled = card.status === "cancelled" || card.status === "used";

  return (
    <div className={`${styles.cardVisual} ${isFrozen ? styles.cardFrozen : ""} ${isBlocked ? styles.cardBlocked : ""} ${isCancelled ? styles.cardCancelled : ""}`}>
      <div className={styles.cardChip} />
      <div className={styles.cardType}>
        {card.isDisposable ? "Single-use" : card.cardType === "debit" ? "Debit" : card.cardType}
      </div>
      <div className={styles.cardNumber}>
        {revealed
          ? revealed.cardNumber.replace(/(\d{4})/g, "$1 ").trim()
          : `•••• •••• •••• ${card.lastFour}`}
      </div>
      <div className={styles.cardBottom}>
        <div>
          <div className={styles.cardLabel}>Expires</div>
          <div className={styles.cardValue}>{fmtExpiry(card.expiryMonth, card.expiryYear)}</div>
        </div>
        {revealed && (
          <div>
            <div className={styles.cardLabel}>CVV</div>
            <div className={styles.cardValue}>{revealed.cvv}</div>
          </div>
        )}
      </div>
      {isFrozen && <div className={styles.cardOverlay}><Snowflake size={32} /><span>Frozen</span></div>}
      {isBlocked && <div className={styles.cardOverlay}><Lock size={32} /><span>Blocked</span></div>}
      {isCancelled && <div className={styles.cardOverlay}><X size={32} /><span>Cancelled</span></div>}
    </div>
  );
}

export default function CardsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [revealed, setRevealed] = useState<CardRevealed | null>(null);
  const [showingReveal, setShowingReveal] = useState(false);
  const [revealedDisposable, setRevealedDisposable] = useState<Record<string, CardRevealed>>({});
  const [merchantBlocks, setMerchantBlocks] = useState<MerchantBlock[]>([]);
  const [newMerchant, setNewMerchant] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { stepUp, requestStepUp, dismissStepUp, submitStepUp, verifyingOtp, stepUpError, requestingOtp } = useStepUp();

  // Load first account, then cards + merchant blocks
  useEffect(() => {
    api.accounts.list()
      .then(({ data }) => {
        if (data.accounts.length === 0) { setLoading(false); return; }
        const acId = data.accounts[0].id;
        setAccountId(acId);
        return Promise.all([
          api.cards.list(acId),
          api.cards.merchantBlocks.list(),
        ]);
      })
      .then((results) => {
        if (!results) return;
        const [cardRes, blockRes] = results;
        setCards(cardRes.data.cards);
        setMerchantBlocks(blockRes.data.blocks);
      })
      .catch(() => setError("Failed to load cards."))
      .finally(() => setLoading(false));
  }, []);

  async function issueCard() {
    if (!accountId) return;
    setActionLoading("issue");
    try {
      const res = await api.cards.issue(accountId);
      setCards((c) => [...c, res.data.card]);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  }

  async function issueDisposable() {
    if (!accountId) return;
    setActionLoading("disposable");
    try {
      const res = await api.cards.issueDisposable(accountId);
      const card = res.data.card;
      // Store the revealed version (has cardNumber + cvv) keyed by id
      setRevealedDisposable(r => ({ ...r, [card.id]: card }));
      // Refresh the full card list from the server so isDisposable/status are correct
      const listRes = await api.cards.list(accountId);
      setCards(listRes.data.cards);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  }

  async function cancelDisposable(card: Card) {
    setActionLoading(`cancel-${card.id}`);
    try {
      await api.cards.cancelDisposable(card.id);
      setCards(c => c.map(x => x.id === card.id ? { ...x, status: "cancelled" as const } : x));
      setRevealedDisposable(r => { const copy = { ...r }; delete copy[card.id]; return copy; });
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  }

  const permanentCard = cards.find(c => !c.isDisposable && c.status !== "cancelled");
  const disposableCards = cards.filter(c => c.isDisposable);

  async function handleReveal() {
    if (!permanentCard) return;
    if (showingReveal) { setRevealed(null); setShowingReveal(false); return; }
    setActionLoading("reveal");
    try {
      const otpToken = await requestStepUp("reveal_card");
      const res = await api.cards.reveal(permanentCard.id, otpToken);
      setRevealed(res.data.card);
      setShowingReveal(true);
    } catch { /* dismissed or failed */ }
    finally { setActionLoading(null); }
  }

  async function handleFreeze() {
    if (!permanentCard) return;
    setActionLoading("freeze");
    try {
      const res = await api.cards.freeze(permanentCard.id);
      setCards(c => c.map(x => x.id === res.data.card.id ? res.data.card : x));
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  }

  async function handleUnfreeze() {
    if (!permanentCard) return;
    setActionLoading("unfreeze");
    try {
      const otpToken = await requestStepUp("unfreeze_card");
      const res = await api.cards.unfreeze(permanentCard.id, otpToken);
      setCards(c => c.map(x => x.id === res.data.card.id ? res.data.card : x));
    } catch { /* dismissed */ }
    finally { setActionLoading(null); }
  }

  async function handleBlock() {
    if (!permanentCard) return;
    setActionLoading("block");
    try {
      const otpToken = await requestStepUp("unblock_card");
      const res = await api.cards.block(permanentCard.id, otpToken);
      setCards(c => c.map(x => x.id === res.data.card.id ? res.data.card : x));
    } catch { /* dismissed */ }
    finally { setActionLoading(null); }
  }

  async function handleUnblock() {
    if (!permanentCard) return;
    setActionLoading("unblock");
    try {
      const otpToken = await requestStepUp("unblock_card");
      const res = await api.cards.unblock(permanentCard.id, otpToken);
      setCards(c => c.map(x => x.id === res.data.card.id ? res.data.card : x));
    } catch { /* dismissed */ }
    finally { setActionLoading(null); }
  }

  async function handleCancel() {
    if (!permanentCard) return;
    if (!confirm("Permanently cancel this card? This cannot be undone.")) return;
    setActionLoading("cancel");
    try {
      const otpToken = await requestStepUp("cancel_card");
      const res = await api.cards.cancel(permanentCard.id, otpToken);
      setCards(c => c.map(x => x.id === res.data.card.id ? res.data.card : x));
      setRevealed(null); setShowingReveal(false);
    } catch { /* dismissed */ }
    finally { setActionLoading(null); }
  }

  async function addMerchantBlock() {
    if (!newMerchant.trim()) return;
    try {
      const res = await api.cards.merchantBlocks.create(newMerchant.trim());
      setMerchantBlocks(b => [res.data.block, ...b]);
      setNewMerchant("");
    } catch (e: any) { setError(e.message); }
  }

  async function removeMerchantBlock(blockId: string) {
    try {
      await api.cards.merchantBlocks.delete(blockId);
      setMerchantBlocks(b => b.filter(x => x.id !== blockId));
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className={styles.loadingShim} />;

  const isFrozen = permanentCard?.isFrozen || permanentCard?.status === "frozen";
  const isBlocked = permanentCard?.status === "blocked";
  const isCancelled = !permanentCard || permanentCard.status === "cancelled";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cards</h1>
        <p className={styles.subtitle}>Manage your Cowry virtual cards and security settings.</p>
      </div>

      {error && <div className={styles.errorBanner}><AlertTriangle size={15} />{error}<button onClick={() => setError("")}><X size={14} /></button></div>}

      {/* Permanent card section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your card</h2>

        {isCancelled ? (
          <div className={styles.noCard}>
            <CreditCard size={40} className={styles.noCardIcon} />
            <p className={styles.noCardText}>No active card</p>
            <button className={styles.issueBtn} onClick={issueCard} disabled={actionLoading === "issue"}>
              <Plus size={16} /> {actionLoading === "issue" ? "Issuing…" : "Issue card"}
            </button>
          </div>
        ) : (
          <div className={styles.cardArea}>
            <CardVisual card={permanentCard!} revealed={showingReveal ? revealed : null} />

            <div className={styles.cardActions}>
              {/* Show/Hide details */}
              <button
                className={styles.actionBtn}
                onClick={() => void handleReveal()}
                disabled={!!actionLoading || permanentCard!.status === "cancelled"}
              >
                {showingReveal ? <EyeOff size={15} /> : <Eye size={15} />}
                {showingReveal ? "Hide details" : "Show details"}
              </button>

              {/* Freeze / Unfreeze */}
              {isFrozen ? (
                <button className={`${styles.actionBtn} ${styles.actionUnfreeze}`} onClick={() => void handleUnfreeze()} disabled={!!actionLoading}>
                  <Unlock size={15} /> Unfreeze card
                </button>
              ) : (
                <button className={`${styles.actionBtn} ${styles.actionFreeze}`} onClick={() => void handleFreeze()} disabled={!!actionLoading || isBlocked}>
                  <Snowflake size={15} /> Freeze card
                </button>
              )}

              {/* Block / Unblock */}
              {isBlocked ? (
                <button className={`${styles.actionBtn} ${styles.actionUnfreeze}`} onClick={() => void handleUnblock()} disabled={!!actionLoading}>
                  <Unlock size={15} /> Unblock card
                </button>
              ) : (
                <button className={`${styles.actionBtn} ${styles.actionBlock}`} onClick={() => void handleBlock()} disabled={!!actionLoading || isFrozen}>
                  <Lock size={15} /> Block card
                </button>
              )}

              {/* Cancel */}
              <button className={`${styles.actionBtn} ${styles.actionCancel}`} onClick={() => void handleCancel()} disabled={!!actionLoading}>
                <ShieldOff size={15} /> Cancel card
              </button>
            </div>

            {isBlocked && (
              <div className={styles.statusWarning}>
                <AlertTriangle size={15} />
                Card is blocked. Unblock it when you&apos;ve found it, or cancel and issue a new one.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Disposable cards */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Single-use cards</h2>
          <button className={styles.outlineBtn} onClick={() => void issueDisposable()} disabled={actionLoading === "disposable"}>
            <Zap size={14} /> {actionLoading === "disposable" ? "Generating…" : "Get disposable card"}
          </button>
        </div>
        <p className={styles.sectionDesc}>
          A single-use card is automatically cancelled after its first transaction — ideal for one-off online purchases.
        </p>
        {disposableCards.length === 0 ? (
          <p className={styles.emptyHint}>No single-use cards yet. Generate one above to get a card number for a one-off purchase.</p>
        ) : (
          <div className={styles.disposableList}>
            {disposableCards.map(c => {
              const rev = revealedDisposable[c.id];
              const isInactive = c.status === "used" || c.status === "cancelled";
              return (
                <div key={c.id} className={`${styles.disposableRow} ${isInactive ? styles.disposableUsed : ""}`}>
                  <CreditCard size={15} className={styles.disposableIcon} />
                  <div className={styles.disposableCardInfo}>
                    <span className={styles.disposablePan}>
                      {rev
                        ? rev.cardNumber.replace(/(\d{4})/g, "$1 ").trim()
                        : `•••• •••• •••• ${c.lastFour}`}
                    </span>
                    {rev && (
                      <span className={styles.disposableSecrets}>
                        Exp {fmtExpiry(c.expiryMonth, c.expiryYear)} · CVV {rev.cvv}
                      </span>
                    )}
                  </div>
                  {!rev && <span className={styles.disposableExpiry}>{fmtExpiry(c.expiryMonth, c.expiryYear)}</span>}
                  <span className={`${styles.statusPill} ${c.status === "active" ? styles.pillActive : styles.pillUsed}`}>
                    {c.status}
                  </span>
                  {!isInactive && (
                    <button
                      className={styles.disposableCancelBtn}
                      title="Cancel card"
                      onClick={() => void cancelDisposable(c)}
                      disabled={actionLoading === `cancel-${c.id}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Merchant blocks */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Blocked merchants</h2>
        <p className={styles.sectionDesc}>Transactions from these merchants will be automatically declined.</p>
        <div className={styles.merchantInput}>
          <input
            className={styles.merchantField}
            placeholder="Merchant name, e.g. Amazon"
            value={newMerchant}
            onChange={e => setNewMerchant(e.target.value)}
            onKeyDown={e => e.key === "Enter" && void addMerchantBlock()}
          />
          <button className={styles.addBtn} onClick={() => void addMerchantBlock()} disabled={!newMerchant.trim()}>
            <Plus size={15} /> Add
          </button>
        </div>
        {merchantBlocks.length === 0 ? (
          <p className={styles.emptyHint}>No merchants blocked.</p>
        ) : (
          <div className={styles.blockList}>
            {merchantBlocks.map(b => (
              <div key={b.id} className={styles.blockRow}>
                <span className={styles.blockName}>{b.merchantName}</span>
                <button className={styles.removeBtn} onClick={() => void removeMerchantBlock(b.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <StepUpModal
        isOpen={stepUp.isOpen}
        action={stepUp.action}
        error={stepUpError}
        verifying={verifyingOtp}
        resending={requestingOtp}
        onSubmit={(code) => void submitStepUp(code)}
        onDismiss={dismissStepUp}
        onResend={() => void requestStepUp(stepUp.action)}
      />
    </div>
  );
}
