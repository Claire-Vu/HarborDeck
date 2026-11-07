// /statechart view for HdDelivery.tla: the captain's words for each state and step.
const who = (v) =>
  v.session === "none" ? "firstmate not running"
  : v.session === "opened" ? "firstmate open, no turn yet"
  : v.session === "busy" ? "firstmate mid-turn"
  : v.watcher ? "firstmate listening" : "firstmate idle, not listening";

const NAME = { req: "order", dec: "decision" };
const one = (v, a) =>
  v.toRoute.includes(a) ? `${NAME[a]} at the bridge`
  : v.inbox.includes(a) ? `${NAME[a]} unread`
  : a === "dec" ? (v.worker === "told" ? "decision passed to the worker" : "decision closed the hold, worker not told")
  : `${NAME[a]} read`;

export const state = (v) => {
  const desk = v.stamped.length ? [...v.stamped].sort().map((a) => one(v, a)).join(", ") : "nothing stamped";
  const wake = !v.inbox.length ? "" : v.typed || v.recent ? ", wake on its way" : v.owed ? ", bridge will check" : "";
  return { Desk: desk + wake, Firstmate: who(v) + (v.faults ? " (after a fault)" : "") };
};

export const step = (action, from, to) => ({
  CaptainStamps: "you stamp on the desk",
  BridgeRoutes: "the bridge routes it",
  BridgeEnsure: to.typed && !from.typed ? (from.session === "none" ? "HarborDeck starts firstmate" : "HarborDeck types a wake") : "HarborDeck checks firstmate",
  GraceExpires: "the wake grace runs out",
  CaptainOpens: "you open firstmate",
  TakesTypedTurn: "firstmate takes the wake",
  CaptainTurn: "you type to firstmate",
  Drains: "firstmate reads its inbox",
  TurnEnds: to.watcher ? "the turn ends, watcher armed" : "the turn ends, no watcher",
  SessionDies: "firstmate dies",
  WakeLost: "the typed wake is lost",
  WatcherDies: "the watcher dies",
  BridgeRestarts: "the bridge restarts",
}[action] ?? action);

export const title = "HarborDeck to firstmate: a stamp reaches a firstmate that acts";
