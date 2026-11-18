import { DrawResult, BetHistoryRecord, TransactionRecord, TransactionStatus } from '../types';

export interface GameServerState {
  currentRoundIndex: number;
  currentRoundTime: string;
  countdown: number;
  isRevealing: boolean;
  revealStep: number;
  drawMix: number[];
  forcedWinningNumber: number | null;
  pendingWinningResult: DrawResult | null;
  history: DrawResult[];
  balance: number;
  recentBets: BetHistoryRecord[];
  transactions: TransactionRecord[];
  isBettingClosed: boolean;
  isRoundPaused?: boolean;
  playerBalances?: Record<string, number>;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'fallback_polling' | 'disconnected';

export type RealtimeEventHandler = (state: Partial<GameServerState>, eventType?: string, rawMsg?: any) => void;
export type StatusEventHandler = (status: ConnectionStatus) => void;

export const PLAYER_TOKEN_STORAGE_KEY = 'l12kh_player_auth_token_v1';
export const ADMIN_TOKEN_STORAGE_KEY = 'l12kh_admin_auth_token_v1';

export function getPlayerToken(): string | null {
  try {
    return localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPlayerToken(token: string | null) {
  try {
    if (token) localStorage.setItem(PLAYER_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(PLAYER_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildAuthHeaders(isAdmin = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isAdmin) {
    const adminToken = getAdminToken();
    if (adminToken) {
      headers['X-Admin-Token'] = adminToken;
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  } else {
    const playerToken = getPlayerToken();
    if (playerToken) {
      headers['X-Player-Token'] = playerToken;
      headers['Authorization'] = `Bearer ${playerToken}`;
    }
  }
  return headers;
}

class RealtimeSyncService {
  private socket: WebSocket | null = null;
  private listeners: Set<RealtimeEventHandler> = new Set();
  private statusListeners: Set<StatusEventHandler> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private fallbackPollerTimer: NodeJS.Timeout | null = null;
  private currentStatus: ConnectionStatus = 'disconnected';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('cambodia_lottery_cross_device_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.state) {
            this.notifyListeners(event.data.state, event.data.type, event.data.rawMsg);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported', e);
      }
    }
  }

  public subscribe(handler: RealtimeEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public subscribeStatus(handler: StatusEventHandler): () => void {
    this.statusListeners.add(handler);
    handler(this.currentStatus);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  private setStatus(status: ConnectionStatus) {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.statusListeners.forEach((l) => {
        try {
          l(status);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  private notifyListeners(partial: Partial<GameServerState>, eventType?: string, rawMsg?: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(partial, eventType, rawMsg);
      } catch (e) {
        console.error('Error in realtime listener', e);
      }
    });
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.setStatus('connected');
        this.stopFallbackPoller();
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingEvent(msg);
        } catch (e) {
          console.warn('Failed to parse incoming WS message', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.socket = null;
        this.setStatus('fallback_polling');
        this.startFallbackPoller();
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
        this.setStatus('fallback_polling');
        this.startFallbackPoller();
      };
    } catch (e) {
      this.isConnecting = false;
      this.setStatus('fallback_polling');
      this.startFallbackPoller();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private startFallbackPoller() {
    if (this.fallbackPollerTimer) return;
    this.fallbackPollerTimer = setInterval(async () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.stopFallbackPoller();
        return;
      }
      await this.fetchInitialState();
    }, 1000);
  }

  private stopFallbackPoller() {
    if (this.fallbackPollerTimer) {
      clearInterval(this.fallbackPollerTimer);
      this.fallbackPollerTimer = null;
    }
  }

  private handleIncomingEvent(msg: { type: string; [key: string]: any }) {
    switch (msg.type) {
      case 'INIT_STATE':
        if (msg.payload) {
          this.notifyListeners(msg.payload, 'INIT_STATE', msg);
          this.broadcastLocally(msg.payload, 'INIT_STATE', msg);
        }
        break;

      case 'TICK':
        this.notifyListeners(
          {
            countdown: msg.countdown,
            currentRoundIndex: msg.currentRoundIndex,
            isBettingClosed: msg.isBettingClosed,
          },
          'TICK',
          msg
        );
        break;

      case 'COUNTDOWN_10S_START':
        this.notifyListeners(
          {
            countdown: msg.countdown ?? 10,
            currentRoundIndex: msg.currentRoundIndex,
            isBettingClosed: true,
          },
          'COUNTDOWN_10S_START',
          msg
        );
        this.broadcastLocally({ countdown: msg.countdown ?? 10, isBettingClosed: true }, 'COUNTDOWN_10S_START', msg);
        break;

      case 'FORCED_RESULT_UPDATED':
        this.notifyListeners(
          {
            forcedWinningNumber: msg.forcedWinningNumber,
          },
          'FORCED_RESULT_UPDATED',
          msg
        );
        this.broadcastLocally({ forcedWinningNumber: msg.forcedWinningNumber }, 'FORCED_RESULT_UPDATED', msg);
        break;

      case 'DRAW_STARTED':
        this.notifyListeners(
          {
            isRevealing: true,
            revealStep: msg.revealStep ?? 1,
            pendingWinningResult: msg.outcomeResult,
            drawMix: msg.drawMix,
            countdown: 0,
            isBettingClosed: true,
          },
          'DRAW_STARTED',
          msg
        );
        this.broadcastLocally(
          {
            isRevealing: true,
            revealStep: msg.revealStep ?? 1,
            pendingWinningResult: msg.outcomeResult,
            drawMix: msg.drawMix,
          },
          'DRAW_STARTED',
          msg
        );
        break;

      case 'DRAW_STEP':
        this.notifyListeners(
          {
            revealStep: msg.revealStep,
            isRevealing: true,
          },
          'DRAW_STEP',
          msg
        );
        break;

      case 'DRAW_FINISHED':
        this.notifyListeners(
          {
            isRevealing: true,
            revealStep: 12,
            pendingWinningResult: msg.outcomeResult,
            history: msg.newHistory,
            recentBets: msg.recentBets,
            balance: msg.newBalance,
            playerBalances: msg.playerBalances,
          },
          'DRAW_FINISHED',
          msg
        );
        this.broadcastLocally(
          {
            history: msg.newHistory,
            recentBets: msg.recentBets,
            balance: msg.newBalance,
            playerBalances: msg.playerBalances,
          },
          'DRAW_FINISHED',
          msg
        );
        break;

      case 'ROUND_RESET':
        this.notifyListeners(
          {
            isRevealing: false,
            revealStep: 0,
            pendingWinningResult: null,
            countdown: msg.countdown ?? 180,
            currentRoundIndex: msg.currentRoundIndex,
            drawMix: msg.drawMix,
            isBettingClosed: false,
          },
          'ROUND_RESET',
          msg
        );
        this.broadcastLocally(
          {
            currentRoundIndex: msg.currentRoundIndex,
            countdown: msg.countdown ?? 180,
          },
          'ROUND_RESET',
          msg
        );
        break;

      case 'BET_PLACED':
        this.notifyListeners(
          {
            recentBets: msg.recentBets,
            balance: msg.newBalance,
            playerBalances: msg.playerBalances,
          },
          'BET_PLACED',
          msg
        );
        this.broadcastLocally(
          {
            recentBets: msg.recentBets,
            balance: msg.newBalance,
            playerBalances: msg.playerBalances,
          },
          'BET_PLACED',
          msg
        );
        break;

      case 'TRANSACTION_UPDATED':
        this.notifyListeners(
          {
            transactions: msg.transactions,
            balance: msg.newBalance,
            playerBalances: msg.playerBalances,
          },
          'TRANSACTION_UPDATED',
          msg
        );
        this.broadcastLocally(
          {
            transactions: msg.transactions,
            balance: msg.newBalance,
            playerBalances: msg.playerBalances,
          },
          'TRANSACTION_UPDATED',
          msg
        );
        break;

      case 'BALANCE_UPDATED':
        this.notifyListeners(
          { balance: msg.newBalance, playerBalances: msg.playerBalances },
          'BALANCE_UPDATED',
          msg
        );
        break;

      case 'PLAYER_UPDATED':
        this.notifyListeners(
          { playerBalances: msg.playerBalances },
          'PLAYER_UPDATED',
          msg
        );
        this.broadcastLocally({ playerBalances: msg.playerBalances }, 'PLAYER_UPDATED', msg);
        break;

      case 'HISTORY_UPDATED':
        this.notifyListeners({ history: msg.history }, 'HISTORY_UPDATED', msg);
        break;

      case 'SESSION_REVOKED':
        this.notifyListeners({}, 'SESSION_REVOKED', msg);
        this.broadcastLocally({}, 'SESSION_REVOKED', msg);
        break;

      case 'AUDIT_LOG_ADDED':
        this.notifyListeners({}, 'AUDIT_LOG_ADDED', msg);
        break;
    }
  }

  private broadcastLocally(state: Partial<GameServerState>, type: string, rawMsg?: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ state, type, rawMsg });
      } catch {
        // Ignore
      }
    }
  }

  public async fetchInitialState(): Promise<GameServerState | null> {
    try {
      const res = await fetch('/api/state', {
        headers: buildAuthHeaders(false),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        this.notifyListeners(data, 'INIT_STATE');
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch state via HTTP', e);
    }
    return null;
  }

  public async setForcedResult(number: number | null) {
    try {
      await fetch('/api/admin/set-result', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ number }),
      });
    } catch (e) {
      console.warn('HTTP fallback failed for setForcedResult', e);
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'SET_FORCED_RESULT',
          token: getAdminToken(),
          payload: { number },
        })
      );
    }
  }

  public async forceDrawNow(targetNumber?: number, withCountdown: boolean = false) {
    try {
      await fetch('/api/admin/force-draw', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ targetNumber, withCountdown }),
      });
    } catch (e) {
      console.warn('HTTP fallback failed for forceDrawNow', e);
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'FORCE_DRAW_NOW',
          token: getAdminToken(),
          payload: { targetNumber },
        })
      );
    }
  }

  public async placeBet(betRecord: BetHistoryRecord) {
    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: buildAuthHeaders(false),
        credentials: 'include',
        body: JSON.stringify({ betRecord }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Failed to post bet', e);
    }
  }

  public async createTransaction(tx: Omit<TransactionRecord, 'id' | 'timestamp' | 'timeString'>) {
    try {
      const isAdminCall = Boolean(getAdminToken());
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: buildAuthHeaders(isAdminCall),
        credentials: 'include',
        body: JSON.stringify(tx),
      });
      return await res.json();
    } catch (e) {
      console.warn('Failed to post transaction', e);
    }
  }

  public async updateTransactionStatus(id: string, status: TransactionStatus) {
    try {
      const res = await fetch(`/api/transaction/${id}/status`, {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Failed to update transaction status', e);
    }
  }

  public async addManualResult(result: DrawResult) {
    try {
      await fetch('/api/admin/manual-result', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ result }),
      });
    } catch (e) {
      console.warn('Failed to add manual result', e);
    }
  }

  public async deleteResult(roundId: string) {
    try {
      await fetch(`/api/admin/result/${encodeURIComponent(roundId)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(true),
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Failed to delete result', e);
    }
  }
}

export const realtimeSync = new RealtimeSyncService();
