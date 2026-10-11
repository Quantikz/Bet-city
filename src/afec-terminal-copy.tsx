import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Skull, X } from "lucide-react";
import { planCentral, matchSymbolName, rollupByCurrency } from "@/lib/mt5/execution";
import { closePositions, connectAccount, executeCentral, getDesk, getSymbols, unlockDesk } from "@/lib/mt5/api";
import { BROKERS } from "@/lib/mt5/brokers";
import type { DeskSnapshot, Mt5Account, OpenPosition, Side } from "@/lib/mt5/types";
import { clearPass, forgetAccount, keepPass, readAccounts, readDeskSettings, readPass, rememberAccount, writeDeskSettings, type SavedAccount } from "@/lib/mt5/vault";

const SYMBOLS = ["XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "BTCUSD", "NAS100", "US30"];
const PROFIT_TARGETS = [100, 200, 500, 1000];

type LogLine = { id: string; at: number; text: string };

type Ticket = { symbol: string; volume: string; sl: string; tp: string };

type OrderConfirm = {
  kind: "order";
  side: Side;
  symbol: string;
  volume: number;
  sl: number | null;
  tp: number | null;
  key: string;
  rows: { accountId: string; broker: string; loginMask: string; multiplier: number; volume: number; symbol: string }[];
};

type CloseConfirm = { kind: "close"; key: string; accountIds: string[]; count: number; positionId?: string; label?: string };

type Confirm = OrderConfirm | CloseConfirm;

type InstallPrompt = Event & { prompt: () => Promise<void> };

function key() {
  return crypto.randomUUID();
}

function notify(title: string, body: string, tag = "afec") {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const show = (registration: ServiceWorkerRegistration) => registration.showNotification(title, { body, icon: "/icons/icon-192.png", tag });
  const worker = navigator.serviceWorker?.controller;
  if (worker) worker.postMessage({ type: "notify", title, body, tag });
  void navigator.serviceWorker?.ready.then(show).catch(() => undefined);
}

function browserSession() {
  const storageKey = "afec.session";
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return "local-session";
  }
}

function stamp(at: number) {
  return new Date(at).toLocaleTimeString("en-GB", { hour12: false });
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function signed(value: number, currency: string) {
  const body = money(Math.abs(value), currency);
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function pct(value: number) {
  const body = `${Math.abs(value).toFixed(2)}%`;
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function tone(value: number) {
  return value < 0 ? "down" : "up";
}

function parseOptional(raw: string): number | null | "bad" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return "bad";
  return value;
}

function mergeAccounts(live: Mt5Account[], saved: SavedAccount[], linking: boolean): Mt5Account[] {
  const byId = new Map(live.map((account) => [account.id, account]));
  if (!saved.length) return live;
  return saved.map(
    (row) =>
      byId.get(row.login) ?? {
        id: row.login,
        broker: row.broker,
        server: row.server,
        loginMask: `****${row.login.slice(-4)}`,
        currency: "USD",
        equity: 0,
        balance: 0,
        floatingPnl: 0,
        state: linking ? "CONNECTING" : "ERROR",
        latencyMs: null,
      },
  );
}

function keepLive(current: DeskSnapshot | null, next: DeskSnapshot, saved: number): DeskSnapshot {
  if (saved && next.accounts.length === 0 && current?.accounts.length) return current;
  if (!current) return next;
  const prior = new Map(current.accounts.map((account) => [account.id, account]));
  const accounts = next.accounts.map((account) => {
    const previous = prior.get(account.id);
    if (account.state === "ERROR" && previous?.state === "ONLINE" && /TIMEOUT|CLOSED|READ FAILED/i.test(account.detail ?? "")) return previous;
    return account;
  });
  const held = new Set(
    next.accounts.filter((account) => account.state === "ERROR" && /TIMEOUT|CLOSED|READ FAILED/i.test(account.detail ?? "") && prior.get(account.id)?.state === "ONLINE").map((account) => account.id),
  );
  return {
    ...next,
    accounts,
    positions: [
      ...next.positions.filter((position) => !held.has(position.accountId)),
      ...current.positions.filter((position) => held.has(position.accountId)),
    ],
  };
}

function savedLinks() {
  return readAccounts().map((account) => ({
    login: account.login,
    password: account.password,
    broker: account.broker,
    server: account.terminal,
  }));
}

export function TerminalApp() {
  const [desk, setDesk] = useState<DeskSnapshot | null>(null);
  const [vault, setVault] = useState<SavedAccount[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [connectOpen, setConnectOpen] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [pnlMode, setPnlMode] = useState<"usd" | "pct">(() => readDeskSettings().pnlMode);
  const [focus, setFocus] = useState<string>(() => readDeskSettings().focus);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => readDeskSettings().selected);
  const [multipliers, setMultipliers] = useState<Record<string, string>>(() => readDeskSettings().multipliers);
  const [ticket, setTicket] = useState<Ticket>(() => readDeskSettings().ticket);
  const [cashTarget, setCashTarget] = useState(() => readDeskSettings().cashTarget);
  const [groups, setGroups] = useState(() => readDeskSettings().groups);
  const [groupId, setGroupId] = useState(() => readDeskSettings().groupId);
  const [theme, setTheme] = useState<"dark" | "light">(() => readDeskSettings().theme);
  const [alerts, setAlerts] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  const [pass, setPass] = useState(() => readPass());
  const [gateError, setGateError] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [catalogs, setCatalogs] = useState<Record<string, string[]>>({});
  const confirmLock = useRef(false);
  const syncing = useRef(false);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const freshAt = useRef(0);
  const cashHits = useRef(new Set<string>());
  const states = useRef<Record<string, string>>({});
  busyRef.current = busy;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function pushLog(text: string) {
    setLogs((current) => [{ id: key(), at: Date.now(), text }, ...current].slice(0, 8));
  }

  function deny(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    if (!text.includes("LOCKED")) return false;
    clearPass();
    setPass("");
    return true;
  }

  async function syncDesk() {
    const mine = ++generation.current;
    const saved = readAccounts();
    const allowed = new Set(saved.map((account) => account.login));
    const next = await getDesk({ data: { sessionId: browserSession(), accounts: savedLinks(), pass: readPass() } });
    if (mine !== generation.current) return next;
    const open = {
      ...next,
      positions: next.positions.filter((position) => allowed.has(position.accountId) && position.volume > 0),
    };
    setVault((current) => {
      const same =
        current.length === saved.length &&
        current.every((row, index) => row.login === saved[index]?.login && row.terminal === saved[index]?.terminal);
      return same ? current : saved;
    });
    setDesk((current) => {
      const recent = freshAt.current > 0 && Date.now() - freshAt.current < 3000 ? current : null;
      if (open.accounts.some((account) => account.state === "ONLINE")) freshAt.current = Date.now();
      return keepLive(recent, open, saved.length);
    });
    setPhase(open.configured || open.accounts.length ? "ready" : "error");
    return open;
  }

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) setInstalled(true);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!pass) return;
    let stop = false;
    let flight = 0;
    const run = (announce: boolean) => {
      if (syncing.current || busyRef.current) return;
      syncing.current = true;
      const id = ++flight;
      const hung = window.setTimeout(() => {
        if (id !== flight) return;
        generation.current += 1;
        syncing.current = false;
      }, 20000);
      void syncDesk()
        .then((next) => {
          if (stop || !announce) return;
          pushLog(next.accounts.length ? "ACCOUNTS RESTORED" : next.configured ? "MT5 CONNECTOR ONLINE" : "MT5 CONNECTOR NOT CONFIGURED");
        })
        .catch((error) => {
          if (stop || id !== flight) return;
          if (deny(error)) return;
          setPhase("error");
          if (announce) pushLog("API UNREACHABLE");
        })
        .finally(() => {
          window.clearTimeout(hung);
          if (id === flight) syncing.current = false;
        });
    };
    run(true);
    const timer = window.setInterval(() => {
      run(false);
    }, 1000);
    const onVis = () => {
      if (!document.hidden) run(false);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, [pass]);

  const roster = desk?.accounts.map((account) => account.id).join("\n") ?? "";
  useEffect(() => {
    if (!desk) return;
    setSelected((current) => {
      let changed = false;
      const next = { ...current };
      for (const account of desk.accounts) {
        if (next[account.id] === undefined) {
          const group = groups.find((item) => item.id === groupId);
          next[account.id] = group ? group.accountIds.includes(account.id) : groupId === "all" || account.state === "ONLINE";
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setMultipliers((current) => {
      let changed = false;
      const next = { ...current };
      for (const account of desk.accounts) {
        if (next[account.id] === undefined) {
          next[account.id] = "1.00";
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [roster, groups, groupId]);

  const online = (desk?.accounts ?? [])
    .filter((account) => account.state === "ONLINE")
    .map((account) => account.id)
    .join("\n");
  useEffect(() => {
    const ids = online.split("\n").filter((id) => id && !catalogs[id]);
    if (!ids.length) return;
    const saved = savedLinks().filter((row) => ids.includes(row.login));
    if (!saved.length) return;
    let stop = false;
    const start = window.setTimeout(() => {
      if (stop) return;
      void getSymbols({ data: { sessionId: browserSession(), accounts: saved, pass: readPass() } })
        .then((rows) => {
          if (stop) return;
          setCatalogs((current) => {
            const next = { ...current };
            for (const row of rows) if (row.names.length) next[row.login] = row.names;
            return next;
          });
        })
        .catch(() => undefined);
    }, 4000);
    const retry = window.setTimeout(() => {
      if (!stop) setCatalogs((current) => ({ ...current }));
    }, 20000);
    return () => {
      stop = true;
      window.clearTimeout(start);
      window.clearTimeout(retry);
    };
  }, [online, catalogs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      setConnectOpen(false);
      setConfirm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  useEffect(() => {
    writeDeskSettings({ selected, multipliers, pnlMode, focus, ticket, cashTarget, groupId, groups, theme });
  }, [selected, multipliers, pnlMode, focus, ticket, cashTarget, groupId, groups, theme]);

  const accounts = useMemo(() => mergeAccounts(desk?.accounts ?? [], vault, phase === "loading"), [desk, vault, phase]);
  const symbols = useMemo(() => {
    const names = new Set<string>();
    for (const account of accounts) {
      for (const name of catalogs[account.id] ?? []) names.add(name);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [accounts, catalogs]);

  useEffect(() => {
    if (!symbols.length) return;
    const current = ticket.symbol.trim().toUpperCase();
    if (symbols.some((name) => name.toUpperCase() === current)) return;
    const matched = matchSymbolName(symbols, current);
    if (!matched || matched.toUpperCase() === current) return;
    setTicket((ticketNow) => (ticketNow.symbol.trim().toUpperCase() === current ? { ...ticketNow, symbol: matched } : ticketNow));
  }, [symbols, ticket.symbol]);

  const positions = desk?.positions ?? [];

  useEffect(() => {
    const target = Number(cashTarget);
    if (!desk || !Number.isFinite(target) || target <= 0 || busyRef.current) return;
    const due = desk.positions.filter((position) => {
      if (cashHits.current.has(position.id)) return false;
      if (!(position.floatingPnl >= target)) return false;
      if (position.floatingPnl > Math.max(target * 20, 100_000)) return false;
      return true;
    });
    if (!due.length) return;
    for (const position of due) cashHits.current.add(position.id);
    busyRef.current = true;
    void (async () => {
      for (const position of due) {
        const saved = readAccounts().find((account) => account.login === position.accountId);
        if (!saved) {
          cashHits.current.delete(position.id);
          continue;
        }
        const result = await closePositions({
          data: {
            accountIds: [position.accountId],
            accounts: [{ login: saved.login, password: saved.password, broker: saved.broker, server: saved.terminal }],
            positionId: position.id,
            idempotencyKey: key(),
            sessionId: browserSession(),
            pass: readPass(),
          },
        });
        if (!result.ok) cashHits.current.delete(position.id);
        const text = result.ok ? `PROFIT +${target} HIT ${position.symbol}` : result.message;
        setNotice(text);
        pushLog(text);
        notify("AFEC", text, "profit");
      }
      busyRef.current = false;
      await syncDesk();
    })();
  }, [desk, cashTarget]);

  useEffect(() => {
    if (!desk) return;
    const seen = states.current;
    for (const account of desk.accounts) {
      const previous = seen[account.id];
      if (previous === "ONLINE" && account.state === "ERROR") notify("AFEC", `${account.broker} LINK DOWN`, account.id);
      seen[account.id] = account.state;
    }
  }, [desk]);

  const armed = useMemo(() => {
    return accounts
      .filter((account) => selected[account.id])
      .map((account) => ({
        account,
        multiplier: Number(multipliers[account.id]),
      }))
      .filter((row) => Number.isFinite(row.multiplier) && row.multiplier > 0);
  }, [accounts, multipliers, selected]);

  useEffect(() => {
    if (focus === "all" || phase === "loading" || accounts.length === 0) return;
    if (accounts.some((account) => account.id === focus)) return;
    setFocus("all");
  }, [accounts, focus, phase]);

  function setAll(on: boolean) {
    setSelected(Object.fromEntries(accounts.map((account) => [account.id, on])));
  }

  function useGroup(id: string) {
    setGroupId(id);
    if (id === "all") {
      setAll(true);
      return;
    }
    const group = groups.find((item) => item.id === id);
    if (!group) {
      setGroupId("");
      return;
    }
    const wanted = new Set(group.accountIds);
    setSelected(Object.fromEntries(accounts.map((account) => [account.id, wanted.has(account.id)])));
  }

  function saveGroup(name: string) {
    const accountIds = accounts.filter((account) => selected[account.id]).map((account) => account.id);
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!clean || !accountIds.length) {
      setNotice("CHECK THE ACCOUNTS TO GROUP");
      return;
    }
    const group = { id: key(), name: clean, accountIds };
    setGroups((current) => [...current, group].slice(-12));
    setGroupId(group.id);
  }

  function dropGroup(id: string) {
    setGroups((current) => current.filter((group) => group.id !== id));
    setGroupId((current) => (current === id ? "" : current));
  }

  function arm(side: Side) {
    const volume = Number(ticket.volume);
    const sl = parseOptional(ticket.sl);
    const tp = parseOptional(ticket.tp);
    if (!Number.isFinite(volume) || volume <= 0 || sl === "bad" || tp === "bad") {
      setNotice("CHECK VOLUME, STOP LOSS, TAKE PROFIT");
      return;
    }
    const checked = accounts.filter((account) => selected[account.id]);
    if (checked.length === 0) {
      setNotice("SELECT AT LEAST ONE ACCOUNT");
      return;
    }
    if (checked.length !== armed.length) {
      setNotice("CHECK MULTIPLIER");
      return;
    }
    const rows = planCentral(
      volume,
      armed.map((row) => ({ accountId: row.account.id, multiplier: row.multiplier })),
    ).map((planned) => {
      const row = armed.find((item) => item.account.id === planned.accountId);
      const listed = catalogs[planned.accountId] ?? [];
      const symbol = listed.length ? matchSymbolName(listed, ticket.symbol) : ticket.symbol;
      return {
        accountId: planned.accountId,
        broker: row?.account.broker ?? planned.accountId,
        loginMask: row?.account.loginMask ?? "",
        multiplier: row?.multiplier ?? 1,
        volume: planned.volume,
        symbol: symbol ?? "",
      };
    });
    const missing = rows.find((row) => !row.symbol);
    if (missing) {
      setNotice(`${missing.broker} HAS NO ${ticket.symbol}`);
      return;
    }
    if (rows.length === 0) {
      setNotice("VOLUME TOO SMALL AFTER MULTIPLIER");
      return;
    }
    setNotice(null);
    setConfirm({
      kind: "order",
      side,
      symbol: ticket.symbol,
      volume,
      sl,
      tp,
      key: key(),
      rows,
    });
  }

  async function runConfirm() {
    if (!confirm || busyRef.current || confirmLock.current) return;
    confirmLock.current = true;
    busyRef.current = true;
    generation.current += 1;
    setBusy(true);
    if (confirm.kind === "close") {
      const accountIds = new Set(confirm.accountIds);
      const positionId = confirm.positionId;
      setDesk((current) =>
        current
          ? {
              ...current,
              positions: current.positions.filter((position) => {
                if (!accountIds.has(position.accountId)) return true;
                return Boolean(positionId && position.id !== positionId);
              }),
            }
          : current,
      );
    }
    try {
      const result =
        confirm.kind === "order"
          ? await executeCentral({
              data: {
                symbol: confirm.symbol,
                side: confirm.side,
                volume: confirm.volume,
                sl: confirm.sl,
                tp: confirm.tp,
                accounts: confirm.rows.map((row) => {
                  const saved = readAccounts().find((account) => account.login === row.accountId);
                  return {
                    accountId: row.accountId,
                    multiplier: row.multiplier,
                    password: saved?.password,
                    broker: saved?.broker,
                    server: saved?.terminal,
                  };
                }),
                idempotencyKey: confirm.key,
                sessionId: browserSession(),
                pass: readPass(),
              },
            })
          : await closePositions({
              data: {
                accountIds: confirm.accountIds,
                accounts: readAccounts().filter((account) => confirm.accountIds.includes(account.login)).map((account) => ({
                  login: account.login,
                  password: account.password,
                  broker: account.broker,
                  server: account.terminal,
                })),
                positionId: confirm.positionId,
                idempotencyKey: confirm.key,
                sessionId: browserSession(),
                pass: readPass(),
              },
            });
      setNotice(result.message);
      pushLog(result.message);
      notify("AFEC", result.message, confirm.kind);
      setConfirm(null);
      await syncDesk();
    } catch (error) {
      if (!deny(error)) {
        setNotice("REQUEST FAILED — SAME KEY HELD");
        pushLog("REQUEST FAILED");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      confirmLock.current = false;
    }
  }

  const iosInstall = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const canInstall = !installed && (installEvent !== null || iosInstall);

  const system =
    phase === "loading" ? "SYNC" : phase === "error" ? "LINK DOWN" : "READY";

  return (
    <div className="terminal-root">
      <MatrixRain />
      {!pass ? (
        <Gate
          busy={gateBusy}
          error={gateError}
          theme={theme}
          onTheme={() => setTheme((mode) => (mode === "light" ? "dark" : "light"))}
          onSubmit={(password) => {
            setGateBusy(true);
            setGateError("");
            void unlockDesk({ data: { password } })
              .then((result) => {
                if (!result.ok) {
                  setGateError(result.message);
                  return;
                }
                keepPass(result.token);
                setPass(result.token);
              })
              .catch((error) => setGateError(error instanceof Error && error.message ? error.message.slice(0, 80) : "ACCESS FAILED"))
              .finally(() => setGateBusy(false));
          }}
        />
      ) : (
        <>
      <div className="terminal-shell">
        <header className="topbar">
          <div className="brand">
            <Skull className="brand-mark" strokeWidth={1.5} aria-hidden="true" />
            <span>AFEC</span>
          </div>
          <div className="panel-tools">
            <span className="sys">
              <span className={phase === "error" ? "sys-dot sys-dot-down" : "sys-dot"} aria-hidden="true" />
              {system}
            </span>
            <button type="button" className="linkish" onClick={() => setTheme((mode) => (mode === "light" ? "dark" : "light"))}>
              {theme === "light" ? "DARK" : "LIGHT"}
            </button>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                if (typeof Notification === "undefined") return;
                if (Notification.permission === "granted") {
                  setAlerts(true);
                  notify("AFEC", "ALERTS ON. THE DESK KEEPS WORKING IN THE BACKGROUND.", "alerts");
                  return;
                }
                void Notification.requestPermission().then((permission) => {
                  const on = permission === "granted";
                  setAlerts(on);
                  if (on) notify("AFEC", "ALERTS ON. THE DESK KEEPS WORKING IN THE BACKGROUND.", "alerts");
                });
              }}
            >
              {alerts ? "ALERTS ON" : "ALERTS"}
            </button>
            {canInstall ? (
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  if (installEvent) {
                    void installEvent.prompt().then(() => setInstallEvent(null));
                    return;
                  }
                  window.location.assign("/?install=1&platform=ios");
                }}
              >
                INSTALL
              </button>
            ) : null}
            {accounts.length > 0 ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (armed.length === 0) {
                    setNotice("SELECT AN ACCOUNT");
                    return;
                  }
                  setConfirm({
                    kind: "close",
                    key: key(),
                    accountIds: armed.map((row) => row.account.id),
                    count: armed.length,
                  });
                }}
              >
                CLOSE ALL
              </button>
            ) : null}
          </div>
        </header>

        {phase === "loading" && !desk ? (
          <Stage kicker="AFEC" title="SYNC" />
        ) : accounts.length === 0 ? (
          <Stage
            kicker="AFEC"
            title="NO ACCOUNTS"
            action={
              <button type="button" className="btn btn-primary btn-block" onClick={() => setConnectOpen(true)}>
                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                CONNECT
              </button>
            }
          />
        ) : (
          <Desk
            accounts={accounts}
            positions={positions}
            selected={selected}
            multipliers={multipliers}
            ticket={ticket}
            cashTarget={cashTarget}
            symbols={symbols.length ? symbols : SYMBOLS}
            pnlMode={pnlMode}
            focus={focus}
            onPnlMode={() => setPnlMode((mode) => (mode === "usd" ? "pct" : "usd"))}
            onFocus={setFocus}
            onSelect={(id, on) => {
              setGroupId("");
              setSelected((current) => ({ ...current, [id]: on }));
            }}
            onMultiplier={(id, value) => setMultipliers((current) => ({ ...current, [id]: value }))}
            onAll={(on) => {
              setGroupId(on ? "all" : "");
              setAll(on);
            }}
            onTicket={setTicket}
            onCashTarget={setCashTarget}
            groups={groups}
            groupId={groupId}
            onGroup={useGroup}
            onSaveGroup={saveGroup}
            onDropGroup={dropGroup}
            onConnect={() => setConnectOpen(true)}
            onForget={(login) => {
              setVault(forgetAccount(login));
              setCatalogs((current) => {
                const next = { ...current };
                delete next[login];
                return next;
              });
              setSelected((current) => {
                const next = { ...current };
                delete next[login];
                return next;
              });
              setMultipliers((current) => {
                const next = { ...current };
                delete next[login];
                return next;
              });
              setFocus((current) => (current === login ? "all" : current));
              setDesk((current) =>
                current
                  ? {
                      ...current,
                      accounts: current.accounts.filter((account) => account.id !== login),
                      positions: current.positions.filter((position) => position.accountId !== login),
                    }
                  : current,
              );
              void syncDesk();
            }}
            onSell={() => arm("SELL")}
            onBuy={() => arm("BUY")}
            onClose={(position) => {
              setConfirm({
                kind: "close",
                key: key(),
                accountIds: [position.accountId],
                count: 1,
                positionId: position.id,
                label: `${position.symbol} ${position.side} ${position.volume.toFixed(2)}`,
              });
            }}
          />
        )}

        {notice ? (
          <p className={`notice ${notice.includes("FAIL") || notice.includes("NOT") || notice.includes("REJECT") ? "down" : "up"}`}>
            {notice}
          </p>
        ) : null}
        <StatusBar
          mt5={!desk?.configured ? "OFF" : accounts.some((account) => account.state === "ONLINE") ? "ONLINE" : "READY"}
          api={phase}
          channel={desk?.channel ?? "idle"}
          logs={logs}
        />
      </div>

      {connectOpen ? (
        <ConnectScreen
          busy={busy}
          onClose={() => {
            if (!busy) setConnectOpen(false);
          }}
          onSubmit={async (form) => {
            setBusy(true);
            try {
              const result = await connectAccount({
                data: {
                  login: form.login,
                  broker: form.broker,
                  server: form.server,
                  password: form.password,
                  idempotencyKey: form.idempotencyKey,
                  sessionId: browserSession(),
                  pass: readPass(),
                },
              });
              if (result.ok) {
                setVault(
                  rememberAccount({
                    login: form.login,
                    password: form.password,
                    broker: form.broker,
                    server: form.serverName,
                    terminal: form.server,
                  }),
                );
                await syncDesk();
                setConnectOpen(false);
                pushLog("ACCOUNT CONNECTED");
                return "ACCOUNT CONNECTED";
              }
              pushLog(result.message);
              return result.message;
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {confirm ? (
        <ConfirmScreen
          confirm={confirm}
          busy={busy}
          onCancel={() => {
            if (!busy) setConfirm(null);
          }}
          onExecute={() => void runConfirm()}
        />
      ) : null}
        </>
      )}
    </div>
  );
}

function Gate({
  busy,
  error,
  theme,
  onTheme,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  theme: "dark" | "light";
  onTheme: () => void;
  onSubmit: (password: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <main className="stage">
      <form
        className="hero"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit(value);
        }}
      >
        <Skull className="mark" strokeWidth={1.25} aria-hidden="true" />
        <p className="kicker">AFEC</p>
        <h1 className="hero-title">ACCESS</h1>
        <label className="field">
          <span>PASSWORD</span>
          <input
            type="password"
            autoComplete="current-password"
            value={value}
            maxLength={32}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || value.length < 8}>
          {busy ? "CHECKING" : "ENTER"}
        </button>
        <button type="button" className="linkish" onClick={onTheme}>
          {theme === "light" ? "DARK" : "LIGHT"}
        </button>
        {error ? <p className="sheet-error">{error}</p> : null}
      </form>
    </main>
  );
}

function MatrixRain() {
  const [cols, setCols] = useState<string[]>([]);

  useEffect(() => {
    const glyphs = "01ABCDEFGHIJKLMNOPQRSTUVWXYZアイウエオカキクケコサシスセソタチツテト";
    const build = () => {
      const count = Math.max(12, Math.ceil(window.innerWidth / 16));
      const rows = Math.ceil(window.innerHeight / 16) + 4;
      setCols(
        Array.from({ length: count }, () => {
          let line = "";
          for (let i = 0; i < rows; i += 1) line += `${glyphs[Math.floor(Math.random() * glyphs.length)]}\n`;
          return line + line;
        }),
      );
    };
    build();
    window.addEventListener("resize", build);
    return () => window.removeEventListener("resize", build);
  }, []);

  return (
    <div className="matrix-rain" aria-hidden="true">
      {cols.map((text, index) => (
        <span
          key={index}
          className="matrix-col"
          style={{ animationDuration: `${7 + (index % 8)}s`, animationDelay: `${-(index % 12) * 0.45}s` }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

function Stage({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return (
    <main className="stage">
      <section className="hero">
        <Skull className="mark" strokeWidth={1.25} aria-hidden="true" />
        <p className="kicker">{kicker}</p>
        <h1 className="hero-title">{title}</h1>
        {action}
      </section>
    </main>
  );
}

function Desk(props: {
  accounts: Mt5Account[];
  positions: OpenPosition[];
  selected: Record<string, boolean>;
  multipliers: Record<string, string>;
  ticket: Ticket;
  cashTarget: string;
  symbols: string[];
  pnlMode: "usd" | "pct";
  focus: string;
  onPnlMode: () => void;
  onFocus: (id: string) => void;
  onSelect: (id: string, on: boolean) => void;
  onMultiplier: (id: string, value: string) => void;
  onAll: (on: boolean) => void;
  onTicket: (ticket: Ticket) => void;
  onCashTarget: (value: string) => void;
  groups: { id: string; name: string }[];
  groupId: string;
  onGroup: (id: string) => void;
  onSaveGroup: (name: string) => void;
  onDropGroup: (id: string) => void;
  onConnect: () => void;
  onForget: (login: string) => void;
  onSell: () => void;
  onBuy: () => void;
  onClose: (position: OpenPosition) => void;
}) {
  const rollup = rollupByCurrency(props.accounts.filter((account) => account.state === "ONLINE"));
  const shown = props.focus === "all" ? props.positions : props.positions.filter((position) => position.accountId === props.focus);
  const armedCount = props.accounts.filter((account) => props.selected[account.id]).length;
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <main className="desk">
      <section className="panel panel-accounts">
        <div className="panel-head">
          <h2 className="panel-title">ACCOUNTS</h2>
          <div className="panel-tools">
            <button type="button" className="linkish" onClick={() => props.onAll(true)}>
              ALL
            </button>
            <button type="button" className="linkish" onClick={() => props.onAll(false)}>
              NONE
            </button>
            <button type="button" className="linkish" onClick={props.onConnect}>
              <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
              ADD
            </button>
          </div>
        </div>
        <div className="group-row">
          <button type="button" className={props.groupId === "" ? "pick on" : "pick"} onClick={() => props.onGroup("")}>
            PICK
          </button>
          <button type="button" className={props.groupId === "all" ? "pick on" : "pick"} onClick={() => props.onGroup("all")}>
            ALL
          </button>
          {props.groups.map((group) => (
            <button type="button" key={group.id} className={props.groupId === group.id ? "pick on" : "pick"} onClick={() => props.onGroup(group.id)}>
              {group.name}
            </button>
          ))}
          {naming ? (
            <input
              aria-label="Group name"
              placeholder="NAME"
              value={draft}
              maxLength={24}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  props.onSaveGroup(draft);
                  setDraft("");
                  setNaming(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="pick"
              onClick={() => {
                setNaming(true);
              }}
            >
              SAVE
            </button>
          )}
          {props.groupId && props.groupId !== "all" ? (
            <button type="button" className="pick" onClick={() => props.onDropGroup(props.groupId)}>
              DROP
            </button>
          ) : null}
        </div>
        <ul className="acct-list">
          {props.accounts.map((account) => (
            <li key={account.id} className="acct">
              <div className="acct-main">
                <label className="acct-check-wrap">
                  <input
                    type="checkbox"
                    className="acct-check"
                    checked={Boolean(props.selected[account.id])}
                    onChange={(event) => props.onSelect(account.id, event.target.checked)}
                  />
                </label>
                <span className="acct-copy">
                  <span className="acct-name">
                    <Dot state={account.state} />
                    <strong>{account.broker}</strong>
                  </span>
                  <span className="acct-meta">
                    {account.loginMask}
                    {account.server ? ` · ${account.server}` : ""}
                    {account.latencyMs != null ? ` · ${account.latencyMs}ms` : ""}
                    <button type="button" className="linkish" onClick={() => props.onForget(account.id)}>
                      REMOVE
                    </button>
                  </span>
                </span>
              </div>
              <span className="eq-stack">
                <span className="eq">{account.state === "ONLINE" ? money(account.balance, account.currency) : "—"}</span>
              </span>
              <label className="mult">
                <span aria-hidden="true">×</span>
                <input
                  inputMode="decimal"
                  value={props.multipliers[account.id] ?? "1.00"}
                  onChange={(event) => props.onMultiplier(account.id, event.target.value)}
                  aria-label={`${account.broker} multiplier`}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel panel-order">
        <h2 className="panel-title">ORDER</h2>
        <div className="ticket">
          <label className="field field-span">
            <span>SYMBOL</span>
            <Picker
              value={props.ticket.symbol}
              options={props.symbols.map((symbol) => ({ value: symbol, label: symbol }))}
              onChange={(symbol) => props.onTicket({ ...props.ticket, symbol })}
            />
          </label>
          <Field label="LOT" value={props.ticket.volume} onChange={(volume) => props.onTicket({ ...props.ticket, volume })} />
          <Field label="SL" value={props.ticket.sl} onChange={(sl) => props.onTicket({ ...props.ticket, sl })} />
          <Field label="TP" value={props.ticket.tp} onChange={(tp) => props.onTicket({ ...props.ticket, tp })} />
        </div>
        <div className="profit-box">
          <span>PROFIT $</span>
          <div className="profit-picks">
            <button type="button" className={props.cashTarget === "" ? "pick on" : "pick"} onClick={() => props.onCashTarget("")}>
              OFF
            </button>
            {PROFIT_TARGETS.map((amount) => (
              <button
                type="button"
                key={amount}
                className={props.cashTarget === String(amount) ? "pick on" : "pick"}
                onClick={() => props.onCashTarget(String(amount))}
              >
                {amount}
              </button>
            ))}
            <input
              inputMode="decimal"
              aria-label="Custom profit target"
              placeholder="CUSTOM"
              value={PROFIT_TARGETS.map(String).includes(props.cashTarget) ? "" : props.cashTarget}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) props.onCashTarget(value);
              }}
            />
          </div>
          <p className="profit-note">{props.cashTarget ? `CLOSES EACH TRADE AT +${props.cashTarget}` : "PRICE TP STAYS ON THE TICKET"}</p>
        </div>
        <p className="armed">{armedCount} ARMED</p>
        <div className="trade-actions">
          <button type="button" className="btn btn-danger" onClick={props.onSell}>
            <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
            SELL
          </button>
          <button type="button" className="btn btn-primary" onClick={props.onBuy}>
            <ArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
            BUY
          </button>
        </div>
      </section>

      <section className="panel panel-positions">
        <div className="panel-head">
          <h2 className="panel-title">POSITIONS</h2>
          <Picker
            className="scope"
            label="Position scope"
            value={props.focus}
            options={[{ value: "all", label: "ALL" }, ...props.accounts.map((account) => ({ value: account.id, label: account.broker }))]}
            onChange={props.onFocus}
          />
        </div>
        {shown.length === 0 ? (
          <p className="flat">FLAT</p>
        ) : (
          <ul className="pos-list">
            {shown.map((position) => (
              <li key={position.id} className="pos">
                <span className="pos-sym">{position.symbol}</span>
                <span className={`pos-side ${position.side === "BUY" ? "up" : "down"}`}>{position.side}</span>
                <span className="pos-lot num">{position.volume.toFixed(2)}</span>
                <span className="pos-meta pos-meta-wide">
                  {position.broker} {position.loginMask}
                </span>
                <span className="pos-meta pos-meta-tight">
                  {position.side} {position.volume.toFixed(2)} · {position.broker}
                </span>
                <span className={`pos-pnl ${tone(position.floatingPnl)}`}>{signed(position.floatingPnl, position.currency)}</span>
                <button type="button" className="btn btn-danger pos-close" onClick={() => props.onClose(position)}>
                  <X size={14} strokeWidth={1.5} aria-hidden="true" />
                  CLOSE
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel panel-book">
        <h2 className="panel-title">BALANCE</h2>
        {rollup.length === 0 ? (
          <div className="book-block">
            <div className="book-value">—</div>
          </div>
        ) : (
          rollup.map((row) => (
            <div key={row.currency} className="book-block">
              <div className="book-value">{money(row.balance, row.currency)}</div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Dot({ state }: { state: Mt5Account["state"] }) {
  const color = state === "ONLINE" ? "sys-dot" : state === "CONNECTING" ? "sys-dot" : "sys-dot sys-dot-down";
  return <span className={color} aria-hidden="true" />;
}

function StatusBar({
  mt5,
  api,
  channel,
  logs,
}: {
  mt5: string;
  api: "loading" | "ready" | "error";
  channel: "idle" | "live";
  logs: LogLine[];
}) {
  const latest = logs[0];
  return (
    <footer className="statusbar">
      <div className="status-cluster">
        <span className={mt5 === "ONLINE" || mt5 === "READY" ? "up" : "down"}>MT5 {mt5}</span>
        <span className={api === "error" ? "down" : "up"}>API {api === "error" ? "ERROR" : api === "loading" ? "SYNC" : "READY"}</span>
        <span>{channel === "live" ? "LIVE" : "IDLE"}</span>
      </div>
      <p className="logline">{latest ? `${stamp(latest.at)}  ${latest.text}` : "—"}</p>
    </footer>
  );
}

function Picker({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 });
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value)?.label ?? value;
  const searchable = options.length > 8;
  const shown = searchable && query.trim()
    ? options.filter((option) => option.label.toUpperCase().includes(query.trim().toUpperCase()))
    : options;
  const visible = shown.slice(0, searchable ? 80 : shown.length);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className={className ? `picker ${className}` : "picker"} ref={root}>
      <button
        type="button"
        className="picker-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          const rect = root.current?.getBoundingClientRect();
          if (rect) setBox({ top: rect.bottom, left: rect.left, width: rect.width });
          setQuery("");
          setOpen((currentOpen) => !currentOpen);
        }}
      >
        <span className="picker-value">{current}</span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="picker-list" role="listbox" style={{ top: box.top, left: box.left, width: box.width }}>
          {searchable ? (
            <li className="picker-search">
              <input
                value={query}
                placeholder="FIND"
                aria-label="Find"
                autoFocus
                onChange={(event) => setQuery(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </li>
          ) : null}
          {visible.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "picker-item on" : "picker-item"}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
          {shown.length > visible.length ? <li className="picker-more">{shown.length - visible.length} MORE — TYPE TO NARROW</li> : null}
          {searchable && shown.length === 0 ? <li className="picker-more">NO MATCH</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function ConnectScreen({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: { login: string; broker: string; server: string; serverName: string; password: string; idempotencyKey: string }) => Promise<string>;
}) {
  const [brokerId, setBrokerId] = useState(BROKERS[0]?.id ?? "metaquotes");
  const broker = BROKERS.find((item) => item.id === brokerId) ?? BROKERS[0];
  const [serverName, setServerName] = useState(broker?.servers[0]?.name ?? "");
  const [custom, setCustom] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const lock = useRef(false);
  const chosen = broker?.servers.find((item) => item.name === serverName) ?? broker?.servers[0];
  const terminal = broker?.id === "other" ? custom.trim() : (chosen?.terminal ?? "");
  const label = broker?.id === "other" ? "CUSTOM" : (chosen?.name ?? "");

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="connect-title">
      <form
        className="sheet"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || lock.current || !terminal) return;
          lock.current = true;
          const secret = password;
          const idempotencyKey = key();
          setPassword("");
          void onSubmit({ login, broker: broker?.name ?? "MT5", server: terminal, serverName: label, password: secret, idempotencyKey }).then((message) => {
            setResult(message);
            lock.current = false;
          });
        }}
      >
        <div className="sheet-head">
          <h2 id="connect-title" className="sheet-title">
            CONNECT
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="stack">
          <label className="field">
            <span>BROKER</span>
            <Picker
              value={brokerId}
              options={BROKERS.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(id) => {
                const next = BROKERS.find((item) => item.id === id) ?? BROKERS[0];
                setBrokerId(next?.id ?? "");
                setServerName(next?.servers[0]?.name ?? "");
              }}
            />
          </label>
          {broker?.id === "other" ? (
            <label className="field">
              <span>WEB TERMINAL</span>
              <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="https://broker-terminal" autoComplete="off" inputMode="url" required />
            </label>
          ) : (
            <label className="field">
              <span>SERVER</span>
              <Picker
                value={serverName}
                options={(broker?.servers ?? []).map((item) => ({ value: item.name, label: item.name }))}
                onChange={setServerName}
              />
            </label>
          )}
          <label className="field">
            <span>LOGIN</span>
            <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="off" required />
          </label>
          <label className="field">
            <span>PASSWORD</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="off" required />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            CANCEL
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !terminal}>
            {busy ? "LINKING" : "CONNECT"}
          </button>
        </div>
        {result && result !== "ACCOUNT CONNECTED" ? <p className="sheet-error">{result}</p> : null}
      </form>
    </div>
  );
}

function ConfirmScreen({
  confirm,
  busy,
  onCancel,
  onExecute,
}: {
  confirm: Confirm;
  busy: boolean;
  onCancel: () => void;
  onExecute: () => void;
}) {
  const title = confirm.kind === "close" ? (confirm.positionId ? "CLOSE" : "CLOSE ALL") : confirm.side;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="sheet">
        <h2 id="confirm-title" className="sheet-title">
          {title}
        </h2>
        {confirm.kind === "order" ? (
          <>
            <p className="confirm-lead">
              {confirm.symbol} · {confirm.volume.toFixed(2)}
            </p>
            <ul className="plan">
              {confirm.rows.map((row) => (
                <li key={row.accountId} className="plan-row">
                  <span>
                    {row.broker} {row.loginMask}
                  </span>
                  <span>{row.symbol}</span>
                  <span>{row.volume.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="confirm-lead">{confirm.label ?? `${confirm.count} ACCOUNTS`}</p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            CANCEL
          </button>
          <button
            type="button"
            className={confirm.kind === "close" ? "btn btn-danger-solid" : "btn btn-primary"}
            onClick={onExecute}
            disabled={busy || (confirm.kind === "close" && confirm.count === 0)}
          >
            {busy ? "SENDING" : confirm.kind === "close" ? "CLOSE" : confirm.side}
          </button>
        </div>
      </div>
    </div>
  );
}
