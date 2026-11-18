import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home,
  Calendar,
  Layers,
  Users,
  Wallet,
  Trophy,
  BarChart3,
  Shield,
  Settings,
  FileText,
  Menu,
  Bell,
  LogOut,
  Plus,
  Search,
  Check,
  X,
  Eye,
  EyeOff,
  Edit3,
  Key,
  Ban,
  CheckCircle2,
  RefreshCw,
  Crown,
  Play,
  Pause,
  Download,
  Copy,
  AlertTriangle,
  Gamepad2,
  Clock,
  Activity,
  Server,
  Database,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Trash2,
} from 'lucide-react';
import {
  ANIMALS_DATA,
  AdminAccount,
  PlayerAccount,
  DrawResult,
  BetHistoryRecord,
  TransactionRecord,
  AuditLogEntry,
  PlatformSettings,
} from '../types';
import { AnimalArtwork } from './AnimalIllustrations';
import { buildAuthHeaders, realtimeSync, setAdminToken } from '../utils/realtimeSync';
import { updateFirestoreGameState, addFirestoreDrawResult } from '../lib/firebase';
import { sound } from '../utils/sound';

export type AdminNavTab =
  | 'dashboard'
  | 'rounds'
  | 'bets'
  | 'users'
  | 'finance'
  | 'results'
  | 'reports'
  | 'staff'
  | 'settings'
  | 'audit';

interface EnterpriseAdminDashboardProps {
  admin: AdminAccount;
  onLogout: () => void;
  onSwitchToGamePortal?: () => void;
}

export const EnterpriseAdminDashboard: React.FC<EnterpriseAdminDashboardProps> = ({
  admin,
  onLogout,
  onSwitchToGamePortal,
}) => {
  const [activeTab, setActiveTab] = useState<AdminNavTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lang, setLang] = useState<'km' | 'en'>('km');

  // Authoritative Overview Data from Backend
  const [players, setPlayers] = useState<PlayerAccount[]>([]);
  const [recentBets, setRecentBets] = useState<BetHistoryRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [history, setHistory] = useState<DrawResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [staffList, setStaffList] = useState<AdminAccount[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(284);
  const [currentRoundTime, setCurrentRoundTime] = useState<string>('16:22');
  const [countdown, setCountdown] = useState<number>(180);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [isRoundPaused, setIsRoundPaused] = useState<boolean>(false);
  const [forcedWinningNumber, setForcedWinningNumber] = useState<number | null>(null);
  const [bettingActivity7d, setBettingActivity7d] = useState<
    { day: string; totalRiel: number; totalUsd: number; betsCount: number }[]
  >([]);
  const [systemHealth, setSystemHealth] = useState<{
    server: string;
    database: string;
    gameService: string;
    wsConnections: number;
    uptimeSeconds: number;
  }>({
    server: 'Online',
    database: 'Online',
    gameService: 'Online',
    wsConnections: 1,
    uptimeSeconds: 120,
  });
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    roundDurationSeconds: 180,
    bettingLockoutSeconds: 10,
    isRoundPaused: false,
    minBetRiel: 1000,
    maxBetRiel: 5000000,
    animalOdds: 11,
    colorOdds: 2.95,
    sizeParityOdds: 1.95,
    maintenanceMode: false,
    sessionTimeoutMinutes: 480,
  });

  // UI Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // One-time password display modal (shown only once after create or password reset)
  const [oneTimeCredentialModal, setOneTimeCredentialModal] = useState<{
    title: string;
    username: string;
    password: string;
    playerId: string;
  } | null>(null);

  // Create New Player Drawer / Panel State
  const [showCreatePanel, setShowCreatePanel] = useState<boolean>(true);
  const [createUsername, setCreateUsername] = useState<string>('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState<boolean>(false);
  const [createPassword, setCreatePassword] = useState<string>('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState<string>('');
  const [showCreatePass, setShowCreatePass] = useState<boolean>(false);
  const [createStatus, setCreateStatus] = useState<'active' | 'disabled'>('active');
  const [isCreatingPlayer, setIsCreatingPlayer] = useState<boolean>(false);

  // Player Directory Search, Filter, Pagination
  const [playerSearch, setPlayerSearch] = useState<string>('');
  const [playerStatusFilter, setPlayerStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [playerPage, setPlayerPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);

  // Edit Player Modal State
  const [editingPlayer, setEditingPlayer] = useState<PlayerAccount | null>(null);
  const [editNewUsername, setEditNewUsername] = useState<string>('');
  const [editNewPassword, setEditNewPassword] = useState<string>('');
  const [editConfirmPassword, setEditConfirmPassword] = useState<string>('');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // View Player Profile Modal State
  const [viewingProfile, setViewingProfile] = useState<{
    player: PlayerAccount;
    bets: BetHistoryRecord[];
    transactions: TransactionRecord[];
  } | null>(null);

  // Results & Manual Result State
  const [manualRoundNum, setManualRoundNum] = useState<number>(285);
  const [manualRoundTime, setManualRoundTime] = useState<string>('16:30');
  const [manualAnimalNum, setManualAnimalNum] = useState<number>(1);
  const [resultSearch, setResultSearch] = useState<string>('');

  // Betting Filter State
  const [betSearch, setBetSearch] = useState<string>('');
  const [betStatusFilter, setBetStatusFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  // Finance Modal State
  const [txFilter, setTxFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [newTxUsername, setNewTxUsername] = useState<string>('player1');
  const [newTxType, setNewTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [newTxAmount, setNewTxAmount] = useState<string>('100000');
  const [newTxMethod, setNewTxMethod] = useState<'ABA Bank' | 'Wing' | 'ACLEDA' | 'TrueMoney'>('ABA Bank');
  const [newTxNote, setNewTxNote] = useState<string>('');

  // Audit Log Filter State
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Fetch Complete Authoritative Overview from Backend
  const fetchOverviewData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: buildAuthHeaders(true),
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        onLogout();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();

      if (data.players) setPlayers(data.players);
      if (data.recentBets) setRecentBets(data.recentBets);
      if (data.transactions) setTransactions(data.transactions);
      if (data.history) setHistory(data.history);
      if (data.recentActivities) setAuditLogs(data.recentActivities);
      if (data.bettingActivity7d) setBettingActivity7d(data.bettingActivity7d);
      if (data.systemHealth) setSystemHealth(data.systemHealth);
      if (data.platformSettings) {
        setPlatformSettings(data.platformSettings);
        setIsRoundPaused(Boolean(data.platformSettings.isRoundPaused));
      }
      if (data.metrics) {
        setCurrentRoundIndex(data.metrics.currentRoundIndex);
        setCurrentRoundTime(data.metrics.currentRoundTime || '16:22');
        setCountdown(data.metrics.countdown);
        setIsRevealing(Boolean(data.metrics.isRevealing));
        setForcedWinningNumber(data.metrics.forcedWinningNumber ?? null);
      }
    } catch (e) {
      console.warn('Failed to fetch admin overview', e);
    }
  }, [onLogout]);

  const fetchStaffAndAudit = useCallback(async () => {
    try {
      const [staffRes, auditRes] = await Promise.all([
        fetch('/api/admin/staff', { headers: buildAuthHeaders(true), credentials: 'include' }),
        fetch('/api/admin/audit-logs', { headers: buildAuthHeaders(true), credentials: 'include' }),
      ]);
      if (staffRes.ok) {
        const sData = await staffRes.json();
        if (sData.staff) setStaffList(sData.staff);
      }
      if (auditRes.ok) {
        const aData = await auditRes.json();
        if (aData.logs) setAuditLogs(aData.logs);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
    fetchStaffAndAudit();

    realtimeSync.connect();
    const unsub = realtimeSync.subscribe((stateUpdate, eventType) => {
      if (stateUpdate.countdown !== undefined) setCountdown(stateUpdate.countdown);
      if (stateUpdate.currentRoundIndex !== undefined) setCurrentRoundIndex(stateUpdate.currentRoundIndex);
      if (stateUpdate.isRevealing !== undefined) setIsRevealing(stateUpdate.isRevealing);
      if (stateUpdate.forcedWinningNumber !== undefined) setForcedWinningNumber(stateUpdate.forcedWinningNumber);
      if (stateUpdate.history !== undefined) setHistory(stateUpdate.history);
      if (stateUpdate.recentBets !== undefined) setRecentBets(stateUpdate.recentBets);
      if (stateUpdate.transactions !== undefined) setTransactions(stateUpdate.transactions);

      if (
        eventType === 'DRAW_FINISHED' ||
        eventType === 'BET_PLACED' ||
        eventType === 'TRANSACTION_UPDATED' ||
        eventType === 'AUDIT_LOG_ADDED' ||
        eventType === 'PLAYER_UPDATED' ||
        eventType === 'BALANCE_UPDATED'
      ) {
        fetchOverviewData();
      }
    });

    return () => {
      unsub();
    };
  }, [fetchOverviewData, fetchStaffAndAudit]);

  // Real-time Username Availability Check
  useEffect(() => {
    const trimmed = createUsername.trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(
          `/api/admin/players/check-username?username=${encodeURIComponent(trimmed)}`,
          {
            headers: buildAuthHeaders(true),
            credentials: 'include',
          }
        );
        if (res.ok) {
          const data = await res.json();
          setUsernameAvailable(Boolean(data.available));
        }
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [createUsername]);

  // Helper: Generate Random Username
  const handleGenerateUsername = () => {
    sound.playButton();
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    const candidate = `player${randDigits}`;
    setCreateUsername(candidate);
  };

  // Helper: Generate Secure Random Password
  const generateSecurePasswordString = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let pass = 'Kh@';
    for (let i = 0; i < 9; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleGenerateCreatePassword = () => {
    sound.playButton();
    const pass = generateSecurePasswordString();
    setCreatePassword(pass);
    setCreateConfirmPassword(pass);
    setShowCreatePass(true);
  };

  // Create New Player Submit
  const handleCreatePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = createUsername.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      showToast('error', 'ឈ្មោះអ្នកប្រើប្រាស់ត្រូវមានយ៉ាងតិច ៣ តួអក្សរ! / Username must be at least 3 chars.');
      return;
    }
    if (!createPassword || createPassword.length < 6) {
      showToast('error', 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ! / Password must be at least 6 chars.');
      return;
    }
    if (createPassword !== createConfirmPassword) {
      showToast('error', 'ពាក្យសម្ងាត់បញ្ជាក់មិនត្រូវគ្នាទេ! / Passwords do not match.');
      return;
    }

    setIsCreatingPlayer(true);
    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          username: trimmedUsername,
          password: createPassword,
          status: createStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'បរាជ័យក្នុងការបង្កើតគណនី!');
        setIsCreatingPlayer(false);
        return;
      }

      sound.playWin();
      const createdPass = createPassword;
      setCreateUsername('');
      setCreatePassword('');
      setCreateConfirmPassword('');
      setUsernameAvailable(null);

      // Show password ONCE in modal
      setOneTimeCredentialModal({
        title: 'បង្កើតគណនីអ្នកលេងថ្មីជោគជ័យ / Player Created Successfully',
        username: data.player.username,
        password: createdPass,
        playerId: data.player.id,
      });

      showToast('success', data.message || `បានបង្កើតគណនី ${data.player.username} ជោគជ័យ!`);
      await fetchOverviewData();
      await fetchStaffAndAudit();
    } catch {
      showToast('error', 'Network error creating player');
    } finally {
      setIsCreatingPlayer(false);
    }
  };

  // Open Edit Modal for Player
  const openEditModal = (p: PlayerAccount) => {
    sound.playButton();
    setEditingPlayer(p);
    setEditNewUsername(p.username);
    setEditNewPassword('');
    setEditConfirmPassword('');
    setShowEditPassword(false);
  };

  // Save Updated Username
  const handleSaveUsername = async () => {
    if (!editingPlayer) return;
    const trimmed = editNewUsername.trim();
    if (!trimmed || trimmed.length < 3) {
      showToast('error', 'ឈ្មោះអ្នកប្រើប្រាស់ថ្មីត្រូវមានយ៉ាងតិច ៣ តួអក្សរ!');
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/players/${editingPlayer.id}/username`, {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ newUsername: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនអាចប្តូរឈ្មោះអ្នកប្រើប្រាស់បានទេ!');
        return;
      }
      sound.playWin();
      setEditingPlayer(data.player);
      showToast('success', data.message || 'បានប្តូរឈ្មោះអ្នកប្រើប្រាស់ជោគជ័យ!');
      await fetchOverviewData();
      await fetchStaffAndAudit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Save New Password for Player
  const handleSaveNewPassword = async () => {
    if (!editingPlayer) return;
    if (!editNewPassword || editNewPassword.length < 6) {
      showToast('error', 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ!');
      return;
    }
    if (editNewPassword !== editConfirmPassword) {
      showToast('error', 'ពាក្យសម្ងាត់បញ្ជាក់មិនត្រូវគ្នាទេ!');
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/players/${editingPlayer.id}/password`, {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ newPassword: editNewPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនអាចប្តូរពាក្យសម្ងាត់បានទេ!');
        return;
      }
      sound.playWin();
      const savedPass = editNewPassword;
      setEditNewPassword('');
      setEditConfirmPassword('');
      setEditingPlayer(data.player);

      // Show newly reset password ONCE
      setOneTimeCredentialModal({
        title: 'ផ្លាស់ប្តូរពាក្យសម្ងាត់ជោគជ័យ / Password Reset Complete',
        username: data.player.username,
        password: savedPass,
        playerId: data.player.id,
      });

      showToast('success', data.message || 'បានផ្លាស់ប្តូរពាក្យសម្ងាត់ថ្មីជោគជ័យ!');
      await fetchOverviewData();
      await fetchStaffAndAudit();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle Enable / Disable Player Status
  const handleTogglePlayerStatus = async (p: PlayerAccount) => {
    const nextStatus = p.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/admin/players/${p.id}/status`, {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('error', data.error || 'បរាជ័យក្នុងការប្តូរស្ថានភាពគណនី!');
        return;
      }
      sound.playButton();
      if (editingPlayer && editingPlayer.id === p.id) {
        setEditingPlayer(data.player);
      }
      showToast('success', data.message);
      await fetchOverviewData();
      await fetchStaffAndAudit();
    } catch {
      showToast('error', 'Failed to update player status');
    }
  };

  // Revoke Player Sessions
  const handleRevokePlayerSessions = async (p: PlayerAccount) => {
    try {
      const res = await fetch(`/api/admin/players/${p.id}/revoke-sessions`, {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sound.playButton();
        if (editingPlayer && editingPlayer.id === p.id) {
          setEditingPlayer(data.player);
        }
        showToast('success', data.message || 'បានបញ្ឈប់ការចូលប្រើប្រាស់ទាំងអស់!');
        await fetchOverviewData();
        await fetchStaffAndAudit();
      }
    } catch {
      showToast('error', 'Failed to revoke sessions');
    }
  };

  // View Player Profile Details
  const handleOpenPlayerProfile = async (p: PlayerAccount) => {
    sound.playButton();
    try {
      const res = await fetch(`/api/admin/players/${p.id}`, {
        headers: buildAuthHeaders(true),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setViewingProfile(data);
      }
    } catch {
      showToast('error', 'មិនអាចទាញយកទិន្នន័យគណនីបានទេ');
    }
  };

  // Round & Result Controls
  const handleSetForcedNumber = async (num: number | null) => {
    sound.playChip();
    const nextVal = forcedWinningNumber === num ? null : num;
    try {
      const res = await fetch('/api/admin/set-result', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ number: nextVal }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនមានសិទ្ធិកំណត់លទ្ធផលទេ! / Permission denied');
        return;
      }
      setForcedWinningNumber(nextVal);
      updateFirestoreGameState({ forcedWinningNumber: nextVal });
      showToast(
        'success',
        nextVal
          ? `កំណត់លទ្ធផលជុំបន្ទាប់: លេខ ${nextVal} (${ANIMALS_DATA[nextVal]?.khmerName})`
          : 'កំណត់លទ្ធផលទៅជាចៃដន្យ (Random)'
      );
      await fetchOverviewData();
      await fetchStaffAndAudit();
    } catch {
      showToast('error', 'Failed to set result');
    }
  };

  const handleForceDrawNow = async (num?: number) => {
    sound.playButton();
    const target = num ?? forcedWinningNumber ?? undefined;
    try {
      const res = await fetch('/api/admin/force-draw', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ targetNumber: target }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនមានសិទ្ធិបញ្ជាចាប់ឆ្នោតទេ! / Permission denied');
        return;
      }
      updateFirestoreGameState({
        isRevealing: true,
        revealStep: 1,
        forcedWinningNumber: target ?? null,
      });
      showToast('success', 'បានបញ្ជាឱ្យចាប់ឆ្នោតភ្លាមៗលើគ្រប់ឧបករណ៍!');
      await fetchOverviewData();
    } catch {
      showToast('error', 'Failed to trigger draw');
    }
  };

  const handleToggleRoundPause = async () => {
    try {
      const res = await fetch('/api/admin/round/pause-resume', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ paused: !isRoundPaused }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនមានសិទ្ធិគ្រប់គ្រងជុំឆ្នោតទេ! / Permission denied');
        return;
      }
      setIsRoundPaused(data.isRoundPaused);
      showToast(
        'success',
        data.isRoundPaused
          ? 'បានផ្អាកការរាប់ថយក្រោយជាបណ្ដោះអាសន្ន (Round Paused)'
          : 'បានបន្តការរាប់ថយក្រោយឡើងវិញ (Round Resumed)'
      );
      await fetchOverviewData();
    } catch {
      showToast('error', 'Failed to toggle round state');
    }
  };

  const handleAddManualResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const animal = ANIMALS_DATA[manualAnimalNum];
    const newRes: DrawResult = {
      roundId: `2004#${manualRoundNum}`,
      roundIndex: manualRoundNum,
      time: manualRoundTime,
      number: manualAnimalNum,
      animal: animal.khmerName,
      color: animal.color,
      size: animal.size,
      parity: animal.parity,
      timestamp: Date.now(),
    };
    try {
      const res = await fetch('/api/admin/manual-result', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ result: newRes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនមានសិទ្ធិបញ្ចូលលទ្ធផលទេ! / Permission denied');
        return;
      }
      addFirestoreDrawResult(newRes);
      showToast('success', `បានបញ្ចូលលទ្ធផលជុំ ${newRes.roundId} = លេខ ${newRes.number} (${newRes.animal})`);
      setManualRoundNum((prev) => prev + 1);
      await fetchOverviewData();
    } catch {
      showToast('error', 'Failed to add manual result');
    }
  };

  const handleDeleteResult = async (roundId: string) => {
    try {
      const res = await fetch(`/api/admin/result/${encodeURIComponent(roundId)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(true),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនមានសិទ្ធិលុបលទ្ធផលទេ! / Permission denied');
        return;
      }
      showToast('success', `បានលុបកំណត់ត្រាលទ្ធផលជុំ ${roundId}`);
      await fetchOverviewData();
    } catch {
      showToast('error', 'Failed to delete result');
    }
  };

  // Financial Actions
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const data = await realtimeSync.createTransaction({
      userName: newTxUsername,
      userPhone: '012 888 999',
      type: newTxType,
      amount: amountNum,
      method: newTxMethod,
      status: 'approved',
      note: newTxNote || 'Admin Authorized Entry',
    });
    if (!data || !data.success) {
      sound.playBlocked();
      showToast('error', data?.error || 'មិនមានសិទ្ធិបង្កើតប្រតិបត្តិការហិរញ្ញវត្ថុទេ! / Permission denied');
      return;
    }
    setNewTxNote('');
    showToast('success', `បានកត់ត្រាប្រតិបត្តិការ ${newTxType} ចំនួន ${amountNum.toLocaleString()}៛`);
    await fetchOverviewData();
  };

  const handleUpdateTxStatus = async (tx: TransactionRecord, status: 'approved' | 'rejected') => {
    const data = await realtimeSync.updateTransactionStatus(tx.id, status);
    if (!data || !data.success) {
      sound.playBlocked();
      showToast('error', data?.error || 'មិនមានសិទ្ធិអនុម័តប្រតិបត្តិការហិរញ្ញវត្ថុទេ! / Permission denied');
      return;
    }
    showToast(
      'success',
      status === 'approved'
        ? `បានអនុម័តប្រតិបត្តិការ ${tx.id} (${tx.amount.toLocaleString()}៛)`
        : `បានបដិសេធប្រតិបត្តិការ ${tx.id}`
    );
    await fetchOverviewData();
  };

  // Save Platform Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(platformSettings),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        sound.playBlocked();
        showToast('error', data.error || 'មិនមានសិទ្ធិកែប្រែការកំណត់ប្រព័ន្ធទេ! / Permission denied');
        return;
      }
      showToast('success', 'បានរក្សាទុកការកំណត់ប្រព័ន្ធដោយជោគជ័យ! / Settings saved.');
      await fetchOverviewData();
    } catch {
      showToast('error', 'Failed to save settings');
    }
  };

  // Export CSV Report
  const handleExportCsv = () => {
    const headers = ['RoundID,Time,WinningNumber,Animal,Color,Size,Parity'];
    const rows = history.map(
      (h) => `${h.roundId},${h.time},${h.number},${h.animal},${h.color},${h.size},${h.parity}`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lottery12kh_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'បានទាញយករបាយការណ៍ CSV ដោយជោគជ័យ!');
  };

  // Filtered & Paginated Players
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const s = playerSearch.trim().toLowerCase();
      const matchSearch =
        !s ||
        p.username.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.displayName.toLowerCase().includes(s);
      const matchStatus =
        playerStatusFilter === 'all' || p.status === playerStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [players, playerSearch, playerStatusFilter]);

  const totalPlayerPages = Math.max(1, Math.ceil(filteredPlayers.length / rowsPerPage));
  const paginatedPlayers = useMemo(() => {
    const start = (playerPage - 1) * rowsPerPage;
    return filteredPlayers.slice(start, start + rowsPerPage);
  }, [filteredPlayers, playerPage, rowsPerPage]);

  const activePlayersCount = useMemo(
    () => players.filter((p) => p.status === 'active').length,
    [players]
  );
  const disabledPlayersCount = useMemo(
    () => players.filter((p) => p.status === 'disabled').length,
    [players]
  );

  const navItems: { id: AdminNavTab; labelKm: string; labelEn: string; icon: React.ElementType }[] = [
    { id: 'dashboard', labelKm: 'ផ្ទាំងគ្រប់គ្រង', labelEn: 'Dashboard', icon: Home },
    { id: 'rounds', labelKm: 'ការចេញឆ្នោត និងកាលវិភាគ', labelEn: 'Lottery Draw & Schedule', icon: Calendar },
    { id: 'bets', labelKm: 'កំណត់ត្រាភ្នាល់', labelEn: 'Betting Records', icon: Layers },
    { id: 'users', labelKm: 'អ្នកប្រើប្រាស់ និងគណនី', labelEn: 'Users & Accounts', icon: Users },
    { id: 'finance', labelKm: 'ដាក់ប្រាក់ និងដកប្រាក់', labelEn: 'Deposits & Withdrawals', icon: Wallet },
    { id: 'results', labelKm: 'លទ្ធផល និងការកំណត់ហ្គេម', labelEn: 'Results & Game Configuration', icon: Trophy },
    { id: 'reports', labelKm: 'របាយការណ៍ និងវិភាគ', labelEn: 'Reports & Analytics', icon: BarChart3 },
    { id: 'staff', labelKm: 'ប្រព័ន្ធ និងសុវត្ថិភាព', labelEn: 'Staff & Permissions', icon: Shield },
    { id: 'settings', labelKm: 'ការកំណត់វេទិកា', labelEn: 'Platform Settings', icon: Settings },
    { id: 'audit', labelKm: 'កំណត់ហេតុប្រតិបត្តិការ', labelEn: 'Audit Logs', icon: FileText },
  ];

  const formatUsd = (riel: number) => {
    const usd = riel / 4000;
    return `$ ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen w-full bg-[#0b081d] text-slate-100 flex font-['Kantumruy_Pro',sans-serif] select-none overflow-x-hidden">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          data-testid="admin-toast"
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-sm font-bold transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
              : 'bg-rose-950/95 border-rose-400 text-rose-100'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20'
        } bg-[#120d2e] border-r border-purple-500/20 flex flex-col justify-between shrink-0 transition-all duration-200 overflow-hidden z-30`}
      >
        <div>
          {/* Brand Crest */}
          <div className="px-4 py-5 border-b border-purple-500/15 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-[2px] shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-2">
              <div className="w-full h-full rounded-[14px] bg-[#140e30] flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            {sidebarOpen && (
              <>
                <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200">
                  Lottery12KH
                </h1>
                <span className="mt-1 px-3 py-0.5 rounded-full bg-purple-900/70 border border-purple-400/40 text-[11px] font-bold text-purple-200">
                  Admin Panel
                </span>
              </>
            )}
          </div>

          {/* Navigation Menu List */}
          <nav className="p-2.5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`admin-nav-${item.id}`}
                  onClick={() => {
                    sound.playButton();
                    setActiveTab(item.id);
                  }}
                  className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white shadow-[0_4px_15px_rgba(124,58,237,0.4)] border border-purple-300/30'
                      : 'text-slate-300 hover:bg-purple-900/30 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-purple-300'}`} />
                  {sidebarOpen && (
                    <div className="flex flex-col leading-tight truncate">
                      <span className="text-xs font-bold truncate">{item.labelKm}</span>
                      <span
                        className={`text-[10px] truncate ${
                          isActive ? 'text-purple-100' : 'text-slate-400'
                        }`}
                      >
                        {item.labelEn}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom System Online Indicator */}
        <div className="p-3 border-t border-purple-500/15">
          <div className="rounded-xl bg-[#18123b] border border-emerald-500/30 px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            {sidebarOpen && (
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-bold text-white">ប្រព័ន្ធដំណើរការ</span>
                <span className="text-[10px] text-emerald-300">System Online</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <div className="text-center text-[11px] text-slate-500 mt-2 font-mono">v1.0.0</div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER BAR */}
        <header className="h-15 bg-[#130e31]/95 border-b border-purple-500/20 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-[#1d1647] hover:bg-[#281f61] text-purple-200 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">
                {navItems.find((n) => n.id === activeTab)?.labelKm}
              </h2>
              <span className="text-xs sm:text-sm text-purple-300/80 hidden sm:inline">
                ({navItems.find((n) => n.id === activeTab)?.labelEn})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onSwitchToGamePortal && (
              <button
                type="button"
                onClick={onSwitchToGamePortal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 text-xs font-bold transition-all cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span className="hidden md:inline">ទំព័រហ្គេម (Game Page)</span>
              </button>
            )}

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className="relative p-2 rounded-lg bg-[#1d1647] hover:bg-[#281f61] text-purple-200 transition-colors cursor-pointer"
              title="Audit & System Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                {Math.min(9, auditLogs.length)}
              </span>
            </button>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'km' ? 'en' : 'km'))}
              className="px-3 py-1.5 rounded-lg bg-[#1d1647] border border-purple-400/30 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <span>🇰🇭</span>
              <span>ខ្មែរ / English</span>
            </button>

            {/* Admin Profile & Logout */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-purple-500/20">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center font-black text-xs text-white border border-purple-300/50">
                {admin.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-xs font-bold text-white">{admin.username}</span>
                <span className="text-[10px] text-purple-300">Super Administrator</span>
              </div>
              <button
                type="button"
                data-testid="admin-logout-button"
                onClick={async () => {
                  await fetch('/api/auth/admin/logout', {
                    method: 'POST',
                    headers: buildAuthHeaders(true),
                    credentials: 'include',
                  });
                  setAdminToken(null);
                  onLogout();
                }}
                className="ml-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="ចាកចេញ / Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">ចាកចេញ</span>
              </button>
            </div>
          </div>
        </header>

        {/* BODY WORKSPACE */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* ========================================== */}
          {/* TAB 1 & TAB 4: DASHBOARD & USERS MANAGEMENT */}
          {/* ========================================== */}
          {(activeTab === 'dashboard' || activeTab === 'users') && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* LEFT / MAIN DASHBOARD COLUMN */}
              <div className={`${showCreatePanel ? 'xl:col-span-9' : 'xl:col-span-12'} space-y-5`}>
                {activeTab === 'dashboard' && (
                  <>
                    {/* Welcome Banner */}
                    <div className="rounded-2xl bg-gradient-to-r from-[#26175c] via-[#3b1d7a] to-[#231454] border border-purple-400/35 p-4 sm:p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
                      <div className="flex items-center gap-4 z-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shrink-0">
                          <Crown className="w-7 h-7 text-amber-300" />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-black text-white">
                            សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រង Lottery12KH
                          </h3>
                          <p className="text-xs sm:text-sm text-purple-200/85">
                            Welcome to Lottery12KH Admin Panel
                          </p>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-2 z-10">
                        {[10, 5, 3].map((n) => (
                          <div
                            key={n}
                            className="w-11 h-11 rounded-xl bg-gradient-to-b from-amber-200 to-amber-500 p-0.5 shadow-md"
                          >
                            <div className="w-full h-full bg-white rounded-[10px] p-0.5">
                              <AnimalArtwork number={n} className="w-full h-full object-contain" />
                            </div>
                          </div>
                        ))}
                        <div className="w-11 h-11 rounded-full bg-gradient-to-b from-purple-500 to-indigo-800 border-2 border-amber-300 flex items-center justify-center font-black text-base text-white shadow-lg">
                          12
                        </div>
                      </div>
                    </div>

                    {/* 5 KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                      {/* KPI 1: Total Players */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#0f295c] to-[#0a1938] border border-blue-400/30 p-4 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/25 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-300" />
                          </div>
                          <div className="leading-tight">
                            <div className="text-xs font-bold text-blue-100">អ្នកប្រើប្រាស់សរុប</div>
                            <div className="text-[11px] text-blue-300/80">Total Players</div>
                          </div>
                        </div>
                        <div
                          data-testid="kpi-total-players"
                          className="text-2xl sm:text-3xl font-black text-white mt-3 font-mono"
                        >
                          {players.length.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                          ▲ Real-time Directory
                        </div>
                      </div>

                      {/* KPI 2: Active Accounts */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#0b3b2e] to-[#07221b] border border-emerald-400/30 p-4 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/25 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-emerald-300" />
                          </div>
                          <div className="leading-tight">
                            <div className="text-xs font-bold text-emerald-100">គណនីសកម្ម</div>
                            <div className="text-[11px] text-emerald-300/80">Active Accounts</div>
                          </div>
                        </div>
                        <div
                          data-testid="kpi-active-players"
                          className="text-2xl sm:text-3xl font-black text-white mt-3 font-mono"
                        >
                          {activePlayersCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                          ▲ Authorized & Enabled
                        </div>
                      </div>

                      {/* KPI 3: Disabled Accounts */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#47142b] to-[#290a18] border border-rose-400/30 p-4 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-rose-500/25 flex items-center justify-center">
                            <UserX className="w-5 h-5 text-rose-300" />
                          </div>
                          <div className="leading-tight">
                            <div className="text-xs font-bold text-rose-100">គណនីបិទ</div>
                            <div className="text-[11px] text-rose-300/80">Disabled Accounts</div>
                          </div>
                        </div>
                        <div
                          data-testid="kpi-disabled-players"
                          className="text-2xl sm:text-3xl font-black text-white mt-3 font-mono"
                        >
                          {disabledPlayersCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-amber-300 font-semibold mt-1">
                          ▲ Access Restricted
                        </div>
                      </div>

                      {/* KPI 4: Current Round */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#45300d] to-[#261905] border border-amber-400/35 p-4 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/25 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="leading-tight">
                            <div className="text-xs font-bold text-amber-100">ជុំបច្ចុប្បន្ន</div>
                            <div className="text-[11px] text-amber-300/80">Current Round</div>
                          </div>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-white mt-2.5 font-mono">
                          #{String(currentRoundIndex).padStart(4, '0')}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isRoundPaused
                                ? 'bg-amber-500/30 text-amber-200'
                                : 'bg-emerald-500/30 text-emerald-200'
                            }`}
                          >
                            ▶ {isRoundPaused ? 'ផ្អាក Paused' : `កំពុងដំណើរការ Running (${countdown}s)`}
                          </span>
                        </div>
                      </div>

                      {/* KPI 5: Transactions Today */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#2d1657] to-[#190b33] border border-purple-400/35 p-4 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/25 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-purple-300" />
                          </div>
                          <div className="leading-tight">
                            <div className="text-xs font-bold text-purple-100">ប្រតិបត្តិការថ្មី (ថ្ងៃនេះ)</div>
                            <div className="text-[11px] text-purple-300/80">Transactions (Today)</div>
                          </div>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-white mt-3 font-mono">
                          {formatUsd(
                            transactions
                              .filter((t) => t.status === 'approved')
                              .reduce((s, t) => s + t.amount, 0)
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                          ▲ {transactions.length} Records
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Betting Activity Chart | System Health | Recent Activities */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* 7-Day Betting Activity Chart */}
                      <div className="lg:col-span-5 rounded-2xl bg-[#140f33] border border-purple-500/25 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <BarChart3 className="w-4 h-4 text-purple-400" />
                              <span>សកម្មភាពភ្នាល់ (7 ថ្ងៃចុងក្រោយ)</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Betting Activity (Last 7 Days)
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-purple-200">
                              សរុបភ្នាល់{' '}
                              <span className="text-white font-mono">
                                {formatUsd(
                                  bettingActivity7d.reduce((s, d) => s + d.totalRiel, 0)
                                )}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">Total Bets Volume</div>
                          </div>
                        </div>

                        {/* Area SVG Chart */}
                        <div className="w-full h-36 pt-2">
                          <svg viewBox="0 0 360 110" className="w-full h-full overflow-visible">
                            <defs>
                              <linearGradient id="betAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M 10 80 Q 65 55, 115 45 T 225 60 T 345 25 L 345 95 L 10 95 Z"
                              fill="url(#betAreaGrad)"
                            />
                            <path
                              d="M 10 80 Q 65 55, 115 45 T 225 60 T 345 25"
                              fill="none"
                              stroke="#c084fc"
                              strokeWidth="3"
                            />
                            {[
                              { x: 10, y: 80, label: 'Nov 12' },
                              { x: 65, y: 60, label: 'Nov 13' },
                              { x: 120, y: 45, label: 'Nov 14' },
                              { x: 175, y: 62, label: 'Nov 15' },
                              { x: 230, y: 58, label: 'Nov 16' },
                              { x: 285, y: 38, label: 'Nov 17' },
                              { x: 345, y: 25, label: 'Nov 18' },
                            ].map((pt, i) => (
                              <g key={i}>
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r="4"
                                  fill="#f59e0b"
                                  stroke="#ffffff"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={pt.x}
                                  y="108"
                                  textAnchor="middle"
                                  fill="#94a3b8"
                                  fontSize="9"
                                >
                                  {pt.label}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>

                      {/* System Health */}
                      <div className="lg:col-span-3 rounded-2xl bg-[#140f33] border border-purple-500/25 p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <span>ស្ថានភាពប្រព័ន្ធ</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mb-3">System Health</div>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between bg-[#1b1442] px-3 py-2 rounded-xl border border-purple-500/15">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-emerald-400" />
                              <div className="leading-tight">
                                <div className="text-xs font-bold text-white">ម៉ាស៊ីនមេ</div>
                                <div className="text-[10px] text-slate-400">Server</div>
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                              {systemHealth.server}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-[#1b1442] px-3 py-2 rounded-xl border border-purple-500/15">
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4 text-emerald-400" />
                              <div className="leading-tight">
                                <div className="text-xs font-bold text-white">មូលដ្ឋានទិន្នន័យ</div>
                                <div className="text-[10px] text-slate-400">Database</div>
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                              {systemHealth.database}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-[#1b1442] px-3 py-2 rounded-xl border border-purple-500/15">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-400" />
                              <div className="leading-tight">
                                <div className="text-xs font-bold text-white">សេវាកម្មហ្គេម</div>
                                <div className="text-[10px] text-slate-400">Game Service</div>
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                              {systemHealth.gameService}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activities */}
                      <div className="lg:col-span-4 rounded-2xl bg-[#140f33] border border-purple-500/25 p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-amber-400" />
                            <span>សកម្មភាពចុងក្រោយ</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mb-2.5">Recent Activities</div>
                        </div>

                        <div className="space-y-2 max-h-[155px] overflow-y-auto pr-1">
                          {auditLogs.slice(0, 4).map((log) => (
                            <div
                              key={log.id}
                              className="flex items-start justify-between gap-2 bg-[#1b1442] px-3 py-2 rounded-xl border border-purple-500/15 text-xs"
                            >
                              <div className="leading-snug truncate">
                                <div className="font-bold text-white truncate">{log.details}</div>
                                <div className="text-[10px] text-purple-300/75">
                                  Actor: {log.actorUsername} ({log.action})
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                                {log.timeString.split(' ')[1] || log.timeString}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* PLAYER DIRECTORY TABLE (Shared in Dashboard & Users Tab) */}
                <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-4 sm:p-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span>បញ្ជីអ្នកប្រើប្រាស់ / Player Accounts</span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 flex-1 sm:flex-initial justify-end">
                      {/* Search Input */}
                      <div className="flex items-center bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        <input
                          type="text"
                          value={playerSearch}
                          onChange={(e) => {
                            setPlayerSearch(e.target.value);
                            setPlayerPage(1);
                          }}
                          placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខ ID..."
                          data-testid="player-directory-search"
                          className="bg-transparent text-xs text-white placeholder-slate-400 w-full focus:outline-none"
                        />
                      </div>

                      {/* Status Filter */}
                      <select
                        value={playerStatusFilter}
                        onChange={(e) => {
                          setPlayerStatusFilter(e.target.value as any);
                          setPlayerPage(1);
                        }}
                        data-testid="player-directory-status-filter"
                        className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none cursor-pointer"
                      >
                        <option value="all">ស្ថានភាព (All Status)</option>
                        <option value="active">សកម្ម (Active)</option>
                        <option value="disabled">បិទ (Disabled)</option>
                      </select>

                      {/* + Create New Player Button */}
                      <button
                        type="button"
                        data-testid="open-create-player-btn"
                        onClick={() => setShowCreatePanel(true)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] text-white text-xs font-bold flex items-center gap-1.5 shadow-md border border-purple-300/40 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>បង្កើតគណនីថ្មី / Create New Player</span>
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                          <th className="py-3 px-3 font-bold">
                            <div>លេខ ID</div>
                            <div className="text-[10px] text-slate-400 font-normal">Player ID</div>
                          </th>
                          <th className="py-3 px-3 font-bold">
                            <div>ឈ្មោះអ្នកប្រើប្រាស់</div>
                            <div className="text-[10px] text-slate-400 font-normal">Username</div>
                          </th>
                          <th className="py-3 px-3 font-bold">
                            <div>ស្ថានភាព</div>
                            <div className="text-[10px] text-slate-400 font-normal">Status</div>
                          </th>
                          <th className="py-3 px-3 font-bold text-right">
                            <div>សមតុល្យ</div>
                            <div className="text-[10px] text-slate-400 font-normal">Balance</div>
                          </th>
                          <th className="py-3 px-3 font-bold text-center">
                            <div>ចំនួនភ្នាល់ (7 ថ្ងៃ)</div>
                            <div className="text-[10px] text-slate-400 font-normal">Bets (7d)</div>
                          </th>
                          <th className="py-3 px-3 font-bold">
                            <div>កាលបរិច្ឆេទបង្កើត</div>
                            <div className="text-[10px] text-slate-400 font-normal">Created At</div>
                          </th>
                          <th className="py-3 px-3 font-bold">
                            <div>ចូលថ្មីចុងក្រោយ</div>
                            <div className="text-[10px] text-slate-400 font-normal">Last Login</div>
                          </th>
                          <th className="py-3 px-3 font-bold text-center">សកម្មភាព</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-500/15">
                        {paginatedPlayers.map((p) => (
                          <tr
                            key={p.id}
                            data-testid={`player-row-${p.username}`}
                            className="hover:bg-purple-900/20 transition-colors"
                          >
                            <td className="py-3 px-3 font-mono font-bold text-purple-200">
                              {p.id}
                            </td>
                            <td className="py-3 px-3 font-bold text-white">{p.username}</td>
                            <td className="py-3 px-3">
                              {p.status === 'active' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  សកម្ម Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[11px] font-bold">
                                  ✕ បិទ Disabled
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-white">
                              <div>{formatUsd(p.balance)}</div>
                              <div className="text-[10px] text-emerald-300/80">
                                {p.balance.toLocaleString()}៛
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-200">
                              {p.betsCount7d}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                              {p.createdAt}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                              {p.lastLogin || '—'}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`edit-player-${p.username}`}
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                                  title="Edit Username & Account"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  data-testid={`reset-pass-${p.username}`}
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 rounded-lg bg-amber-500/85 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                                  title="Reset Password"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  data-testid={`toggle-status-${p.username}`}
                                  onClick={() => handleTogglePlayerStatus(p)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    p.status === 'active'
                                      ? 'bg-rose-600/80 hover:bg-rose-500 text-white'
                                      : 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
                                  }`}
                                  title={
                                    p.status === 'active' ? 'Disable Account' : 'Enable Account'
                                  }
                                >
                                  {p.status === 'active' ? (
                                    <Ban className="w-3.5 h-3.5" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  data-testid={`view-profile-${p.username}`}
                                  onClick={() => handleOpenPlayerProfile(p)}
                                  className="p-1.5 rounded-lg bg-purple-700/70 hover:bg-purple-600 text-white transition-colors cursor-pointer"
                                  title="View Full Profile, Bets & Transactions"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {paginatedPlayers.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              រកមិនឃើញគណនីអ្នកប្រើប្រាស់ទេ / No matching player accounts found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="mt-4 pt-3 border-t border-purple-500/15 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                    <div>
                      បង្ហាញ {(playerPage - 1) * rowsPerPage + 1} -{' '}
                      {Math.min(playerPage * rowsPerPage, filteredPlayers.length)} នៃ{' '}
                      {filteredPlayers.length} / Showing {paginatedPlayers.length} of{' '}
                      {filteredPlayers.length}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={playerPage <= 1}
                        onClick={() => setPlayerPage((p) => Math.max(1, p - 1))}
                        className="p-1.5 rounded-lg bg-[#1c1545] border border-purple-500/30 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPlayerPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setPlayerPage(pg)}
                          className={`w-7 h-7 rounded-lg font-bold text-xs cursor-pointer ${
                            playerPage === pg
                              ? 'bg-purple-600 text-white'
                              : 'bg-[#1c1545] text-slate-300 hover:bg-purple-900/40'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={playerPage >= totalPlayerPages}
                        onClick={() => setPlayerPage((p) => Math.min(totalPlayerPages, p + 1))}
                        className="p-1.5 rounded-lg bg-[#1c1545] border border-purple-500/30 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span>ចំនួនក្នុងមួយទំព័រ / Rows per page:</span>
                      <select
                        value={rowsPerPage}
                        onChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setPlayerPage(1);
                        }}
                        className="bg-[#1c1545] border border-purple-400/30 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: CREATE NEW PLAYER DRAWER (Matches Screenshot 3) */}
              {showCreatePanel && (
                <div className="xl:col-span-3 rounded-2xl bg-gradient-to-b from-[#231557] via-[#18103d] to-[#120c2e] border border-purple-400/40 p-5 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-purple-400/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/25 border border-purple-300/30 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-purple-200" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">បង្កើតគណនីអ្នកលេងថ្មី</h3>
                        <p className="text-[11px] text-purple-200/75">Create New Player</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreatePanel(false)}
                      className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreatePlayerSubmit} className="space-y-4">
                    {/* Username Field + Auto Generate */}
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        ឈ្មោះអ្នកប្រើប្រាស់ <span className="text-rose-400">*</span>
                        <span className="block text-[10px] text-slate-300 font-normal">
                          Username *
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1 flex items-center bg-[#120d2b] border border-purple-400/35 rounded-xl px-3 h-10">
                          <input
                            type="text"
                            value={createUsername}
                            onChange={(e) => setCreateUsername(e.target.value)}
                            placeholder="player7890"
                            data-testid="create-player-username"
                            className="w-full bg-transparent text-xs font-mono text-white focus:outline-none pr-5"
                          />
                          {usernameAvailable === true && (
                            <Check
                              data-testid="username-available-check"
                              className="w-4 h-4 text-emerald-400 shrink-0"
                            />
                          )}
                          {usernameAvailable === false && (
                            <X className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateUsername}
                          data-testid="generate-username-btn"
                          className="px-3 h-10 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-[11px] font-bold shrink-0 cursor-pointer border border-purple-300/30"
                        >
                          <div>បង្កើតស្វ័យប្រវត្តិ</div>
                          <div className="text-[9px] text-purple-200 font-normal">Generate</div>
                        </button>
                      </div>
                      {checkingUsername && (
                        <span className="text-[10px] text-purple-300 mt-1 block">
                          កំពុងពិនិត្យ... / Checking availability...
                        </span>
                      )}
                      {usernameAvailable === false && (
                        <span className="text-[10px] text-rose-400 mt-1 block">
                          ឈ្មោះនេះមានរួចហើយ! / Username is already taken.
                        </span>
                      )}
                    </div>

                    {/* Password Field + Generate Secure Password */}
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        ពាក្យសម្ងាត់ <span className="text-rose-400">*</span>
                        <span className="block text-[10px] text-slate-300 font-normal">
                          Password *
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1 flex items-center bg-[#120d2b] border border-purple-400/35 rounded-xl px-3 h-10">
                          <input
                            type={showCreatePass ? 'text' : 'password'}
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                            placeholder="••••••••••"
                            data-testid="create-player-password"
                            className="w-full bg-transparent text-xs font-mono text-white focus:outline-none pr-6"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCreatePass((p) => !p)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {showCreatePass ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateCreatePassword}
                          data-testid="generate-password-btn"
                          className="px-3 h-10 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-[11px] font-bold shrink-0 cursor-pointer border border-purple-300/30"
                        >
                          <div>បង្កើតពាក្យសម្ងាត់</div>
                          <div className="text-[9px] text-purple-200 font-normal">Generate</div>
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        បញ្ជាក់ពាក្យសម្ងាត់ <span className="text-rose-400">*</span>
                        <span className="block text-[10px] text-slate-300 font-normal">
                          Confirm Password *
                        </span>
                      </label>
                      <div className="flex items-center bg-[#120d2b] border border-purple-400/35 rounded-xl px-3 h-10">
                        <input
                          type={showCreatePass ? 'text' : 'password'}
                          value={createConfirmPassword}
                          onChange={(e) => setCreateConfirmPassword(e.target.value)}
                          placeholder="••••••••••"
                          data-testid="create-player-confirm-password"
                          className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                        />
                        {createPassword &&
                          createConfirmPassword &&
                          createPassword === createConfirmPassword && (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                      </div>
                    </div>

                    {/* Account Status */}
                    <div>
                      <label className="block text-xs font-bold text-white mb-1">
                        ស្ថានភាពគណនី
                        <span className="block text-[10px] text-slate-300 font-normal">
                          Account Status
                        </span>
                      </label>
                      <select
                        value={createStatus}
                        onChange={(e) => setCreateStatus(e.target.value as 'active' | 'disabled')}
                        data-testid="create-player-status"
                        className="w-full h-10 rounded-xl bg-[#120d2b] border border-purple-400/35 px-3 text-xs font-bold text-white focus:outline-none cursor-pointer"
                      >
                        <option value="active">🟢 សកម្ម (Active)</option>
                        <option value="disabled">🔴 បិទ (Disabled)</option>
                      </select>
                    </div>

                    {/* Info Box */}
                    <div className="rounded-xl bg-[#161b42] border border-blue-400/30 p-3 text-[11px] text-blue-100 leading-relaxed">
                      <p className="font-semibold">
                        គណនីនេះនឹងអាចចូលប្រើប្រាស់នៅលើទំព័រហ្គេមភ្លាមៗបន្ទាប់ពីបង្កើត។
                      </p>
                      <p className="text-blue-300/80 mt-0.5">
                        The player can log in to the game page immediately after the account is created.
                      </p>
                    </div>

                    {/* Submit & Cancel Buttons */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="submit"
                        disabled={isCreatingPlayer}
                        data-testid="submit-create-player-btn"
                        className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] text-white font-black text-xs shadow-lg border border-purple-300/40 flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <span>+ បង្កើតគណនី</span>
                        <span className="text-[10px] font-normal text-purple-100">Create Player</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateUsername('');
                          setCreatePassword('');
                          setCreateConfirmPassword('');
                        }}
                        className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex flex-col items-center justify-center border border-slate-600/50 cursor-pointer"
                      >
                        <span>បោះបង់</span>
                        <span className="text-[10px] font-normal text-slate-400">Cancel</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 2: LOTTERY ROUND MANAGEMENT (ROUNDS)   */}
          {/* ========================================== */}
          {activeTab === 'rounds' && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-white">
                      ការគ្រប់គ្រងជុំឆ្នោត និងកាលវិភាគ / Lottery Round & Schedule Control
                    </h3>
                    <p className="text-xs text-purple-300/80">
                      គ្រប់គ្រងការរាប់ថយក្រោយ ផ្អាក/បន្ត និងចាប់ឆ្នោតភ្លាមៗតាមពេលវេលាជាក់ស្តែង
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleRoundPause}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border cursor-pointer ${
                        isRoundPaused
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                          : 'bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-300'
                      }`}
                    >
                      {isRoundPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      <span>
                        {isRoundPaused ? 'បន្តជុំឆ្នោត (Resume Round)' : 'ផ្អាកជុំឆ្នោត (Pause Round)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleForceDrawNow()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 border border-purple-400/50 cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>ចាប់ឆ្នោតភ្លាមៗ (Trigger Draw Now)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-5">
                  <div className="rounded-xl bg-[#1c1545] border border-purple-500/20 p-4">
                    <div className="text-xs text-slate-400">ជុំបច្ចុប្បន្ន / Current Round</div>
                    <div className="text-2xl font-black text-amber-300 font-mono mt-1">
                      2004#{currentRoundIndex}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#1c1545] border border-purple-500/20 p-4">
                    <div className="text-xs text-slate-400">រាប់ថយក្រោយ / Countdown</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                      {countdown}s
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#1c1545] border border-purple-500/20 p-4">
                    <div className="text-xs text-slate-400">ស្ថានភាពជុំ / Round Status</div>
                    <div className="text-lg font-black text-white mt-1">
                      {isRevealing ? 'កំពុងបើកលទ្ធផល (Revealing)' : isRoundPaused ? 'ផ្អាក (Paused)' : 'កំពុងដំណើរការ (Running)'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#1c1545] border border-purple-500/20 p-4">
                    <div className="text-xs text-slate-400">រយៈពេលក្នុងមួយជុំ / Duration</div>
                    <div className="text-2xl font-black text-purple-300 font-mono mt-1">
                      {platformSettings.roundDurationSeconds}s
                    </div>
                  </div>
                </div>
              </div>

              {/* Round History Table */}
              <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5">
                <h4 className="text-sm font-black text-white mb-3">
                  ប្រវត្តិជុំឆ្នោតថ្មីៗ / Completed Round Schedule & History
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                        <th className="py-2.5 px-3">លេខជុំ (Round ID)</th>
                        <th className="py-2.5 px-3">ម៉ោង (Time)</th>
                        <th className="py-2.5 px-3">លទ្ធផល (Result)</th>
                        <th className="py-2.5 px-3">ពណ៌ (Color)</th>
                        <th className="py-2.5 px-3">ទំហំ / សេសគូ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/15">
                      {history.slice(0, 15).map((h, i) => (
                        <tr key={`${h.roundId}-${i}`} className="hover:bg-purple-900/20">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                            {h.roundId}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{h.time}</td>
                          <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-white p-0.5 inline-block">
                              <AnimalArtwork number={h.number} className="w-full h-full object-contain" />
                            </span>
                            <span>
                              លេខ {h.number} - {h.animal}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 uppercase font-bold text-purple-200">
                            {h.color}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {h.size === 'big' ? 'ធំ (Big)' : 'តូច (Small)'} •{' '}
                            {h.parity === 'odd' ? 'សេស (Odd)' : 'គូ (Even)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 6: RESULTS & GAME CONFIGURATION        */}
          {/* ========================================== */}
          {activeTab === 'results' && (
            <div className="space-y-5">
              {/* Pre-determine Next Winning Number */}
              <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-black text-white">
                      កំណត់លទ្ធផលឆ្នោតជុំបន្ទាប់ / Authorized Result Control (Round 2004#{currentRoundIndex})
                    </h3>
                    <p className="text-xs text-purple-300/80">
                      ជ្រើសរើសសត្វឈ្នះសម្រាប់ជុំបច្ចុប្បន្ន ឬទុកឱ្យប្រព័ន្ធចាប់ដោយចៃដន្យ (Random)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300">ស្ថានភាពបច្ចុប្បន្ន:</span>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                      {forcedWinningNumber
                        ? `កំណត់មុន: លេខ ${forcedWinningNumber} (${ANIMALS_DATA[forcedWinningNumber]?.khmerName})`
                        : 'ចៃដន្យធម្មតា (Random Mode)'}
                    </span>
                    {forcedWinningNumber && (
                      <button
                        type="button"
                        onClick={() => handleSetForcedNumber(null)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                      >
                        Reset to Random
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                    const animal = ANIMALS_DATA[num];
                    const isSelected = forcedWinningNumber === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        data-testid={`force-result-${num}`}
                        onClick={() => handleSetForcedNumber(num)}
                        className={`rounded-xl p-3 border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/25 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                            : 'bg-[#1b1442] border-purple-500/25 hover:border-purple-400'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-300">{animal.khmerName}</div>
                          <div className="text-2xl font-black text-white font-mono">#{num}</div>
                          <div className="text-[10px] text-amber-300 font-semibold mt-0.5">
                            {isSelected ? '✓ បានជ្រើសរើស' : 'ចុចកំណត់'}
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-lg bg-white p-0.5 shrink-0">
                          <AnimalArtwork number={num} className="w-full h-full object-contain" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual Result Entry & Result History */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <form
                  onSubmit={handleAddManualResult}
                  className="lg:col-span-4 rounded-2xl bg-[#140f33] border border-purple-500/25 p-5 space-y-4"
                >
                  <h4 className="text-sm font-black text-white">
                    បញ្ចូលកំណត់ត្រាលទ្ធផលដោយដៃ / Add Manual Result Record
                  </h4>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">លេខជុំ (Round Index)</label>
                    <input
                      type="number"
                      value={manualRoundNum}
                      onChange={(e) => setManualRoundNum(Number(e.target.value))}
                      className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">ម៉ោង (Time)</label>
                    <input
                      type="text"
                      value={manualRoundTime}
                      onChange={(e) => setManualRoundTime(e.target.value)}
                      className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">ជ្រើសរើសសត្វឈ្នះ (1-12)</label>
                    <select
                      value={manualAnimalNum}
                      onChange={(e) => setManualAnimalNum(Number(e.target.value))}
                      className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          លេខ {n} - {ANIMALS_DATA[n].khmerName} ({ANIMALS_DATA[n].animalEn})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    + រក្សាទុកលទ្ធផល (Save Result)
                  </button>
                </form>

                <div className="lg:col-span-8 rounded-2xl bg-[#140f33] border border-purple-500/25 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-black text-white">
                      ប្រវត្តិលទ្ធផលទាំងអស់ / Official Results History ({history.length})
                    </h4>
                    <input
                      type="text"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                      placeholder="ស្វែងរកជុំ ឬសត្វ..."
                      className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="overflow-x-auto max-h-[360px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                          <th className="py-2 px-3">Round ID</th>
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Animal</th>
                          <th className="py-2 px-3">Attributes</th>
                          <th className="py-2 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-500/15">
                        {history
                          .filter(
                            (h) =>
                              !resultSearch ||
                              h.roundId.toLowerCase().includes(resultSearch.toLowerCase()) ||
                              h.animal.includes(resultSearch)
                          )
                          .map((h, i) => (
                            <tr key={`${h.roundId}-${i}`} className="hover:bg-purple-900/20">
                              <td className="py-2 px-3 font-mono font-bold text-amber-300">
                                {h.roundId}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-300">{h.time}</td>
                              <td className="py-2 px-3 font-bold text-white">
                                #{h.number} {h.animal}
                              </td>
                              <td className="py-2 px-3 text-slate-300 uppercase">
                                {h.color} • {h.size} • {h.parity}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteResult(h.roundId)}
                                  className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 3: BETTING MANAGEMENT (BETS)           */}
          {/* ========================================== */}
          {activeTab === 'bets' && (
            <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white">
                    កំណត់ត្រាភ្នាល់របស់អ្នកលេង / Authoritative Betting Records
                  </h3>
                  <p className="text-xs text-purple-300/80">
                    បង្ហាញរាល់ការភ្នាល់ ឈ្មោះអ្នកលេង ជុំឆ្នោត ទឹកប្រាក់ ហាងឆេង និងលទ្ធផលឈ្នះ/ចាញ់
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={betSearch}
                    onChange={(e) => setBetSearch(e.target.value)}
                    placeholder="ស្វែងរកតាមអ្នកលេង ឬជុំ..."
                    className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <select
                    value={betStatusFilter}
                    onChange={(e) => setBetStatusFilter(e.target.value as any)}
                    className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">គ្រប់ស្ថានភាព (All)</option>
                    <option value="pending">កំពុងរង់ចាំ (Pending)</option>
                    <option value="won">ឈ្នះ (Won)</option>
                    <option value="lost">មិនឈ្នះ (Did not win)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                      <th className="py-3 px-3">Player Username</th>
                      <th className="py-3 px-3">Round ID</th>
                      <th className="py-3 px-3">Selected Bet</th>
                      <th className="py-3 px-3 text-right">Wager Amount</th>
                      <th className="py-3 px-3 text-center">Accepted Odds</th>
                      <th className="py-3 px-3 text-right">Potential Payout</th>
                      <th className="py-3 px-3 text-right">Actual Payout</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15">
                    {recentBets
                      .filter((rec) => {
                        const matchStatus =
                          betStatusFilter === 'all' || rec.status === betStatusFilter;
                        const s = betSearch.trim().toLowerCase();
                        const matchSearch =
                          !s ||
                          (rec.username && rec.username.toLowerCase().includes(s)) ||
                          rec.roundId.toLowerCase().includes(s);
                        return matchStatus && matchSearch;
                      })
                      .map((rec) => {
                        const firstBet = rec.bets[0];
                        return (
                          <tr key={rec.id} className="hover:bg-purple-900/20">
                            <td className="py-3 px-3 font-bold text-white">
                              {rec.username || 'player1'}
                            </td>
                            <td className="py-3 px-3 font-mono text-amber-300 font-bold">
                              {rec.roundId}
                            </td>
                            <td className="py-3 px-3 text-purple-200 font-semibold">
                              {rec.bets.map((b) => b.label).join(', ')}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-white">
                              {rec.totalStake.toLocaleString()}៛
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-amber-300">
                              x{firstBet?.odds ?? 1.95}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-blue-300">
                              {rec.totalPotentialPayout.toLocaleString()}៛
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                              {rec.totalPayout.toLocaleString()}៛
                            </td>
                            <td className="py-3 px-3 text-center">
                              {rec.status === 'pending' ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                                  Pending
                                </span>
                              ) : rec.status === 'won' ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                                  Won
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[11px] font-bold">
                                  Did not win
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {recentBets.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          មិនទាន់មានកំណត់ត្រាភ្នាល់នៅឡើយទេ / No betting records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 5: FINANCIAL RECORDS (FINANCE)         */}
          {/* ========================================== */}
          {activeTab === 'finance' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Record Authorized Deposit/Withdrawal */}
              <form
                onSubmit={handleCreateTransaction}
                className="lg:col-span-4 rounded-2xl bg-[#140f33] border border-purple-500/25 p-5 space-y-4"
              >
                <h3 className="text-sm font-black text-white">
                  បញ្ចូលប្រតិបត្តិការហិរញ្ញវត្ថុ / Authorized Wallet Entry
                </h3>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">ជ្រើសរើសគណនីអ្នកលេង</label>
                  <select
                    value={newTxUsername}
                    onChange={(e) => setNewTxUsername(e.target.value)}
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white"
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.username}>
                        {p.username} ({p.id}) — {p.balance.toLocaleString()}៛
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">ប្រភេទប្រតិបត្តិការ</label>
                  <select
                    value={newTxType}
                    onChange={(e) => setNewTxType(e.target.value as 'deposit' | 'withdrawal')}
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white"
                  >
                    <option value="deposit">ដាក់ប្រាក់ (Deposit)</option>
                    <option value="withdrawal">ដកប្រាក់ (Withdrawal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">ចំនួនទឹកប្រាក់ (៛)</label>
                  <input
                    type="number"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">ធនាគារ / មធ្យោបាយ</label>
                  <select
                    value={newTxMethod}
                    onChange={(e) => setNewTxMethod(e.target.value as any)}
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white"
                  >
                    <option value="ABA Bank">ABA Bank</option>
                    <option value="Wing">Wing</option>
                    <option value="ACLEDA">ACLEDA</option>
                    <option value="TrueMoney">TrueMoney</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs cursor-pointer"
                >
                  + អនុម័តប្រតិបត្តិការ (Submit Ledger Entry)
                </button>
              </form>

              {/* Financial Ledger Table */}
              <div className="lg:col-span-8 rounded-2xl bg-[#140f33] border border-purple-500/25 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-white">
                    កំណត់ត្រាហិរញ្ញវត្ថុ និងផ្ទៀងផ្ទាត់ / Financial Ledger & Reconciliation
                  </h3>
                  <select
                    value={txFilter}
                    onChange={(e) => setTxFilter(e.target.value as any)}
                    className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Reconciled / Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Reconciliation</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/15">
                      {transactions
                        .filter((t) => txFilter === 'all' || t.status === txFilter)
                        .map((tx) => (
                          <tr key={tx.id} className="hover:bg-purple-900/20">
                            <td className="py-2.5 px-3 font-mono text-slate-300">{tx.id}</td>
                            <td className="py-2.5 px-3 font-bold text-white">{tx.userName}</td>
                            <td className="py-2.5 px-3 uppercase font-bold">
                              <span
                                className={
                                  tx.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'
                                }
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                              {tx.amount.toLocaleString()}៛
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{tx.method}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  tx.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : tx.status === 'pending'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {tx.status === 'pending' ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTxStatus(tx, 'approved')}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTxStatus(tx, 'rejected')}
                                    className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">Verified</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 7: REPORTS & ANALYTICS                 */}
          {/* ========================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white">
                    របាយការណ៍សរុប និងការវិភាគទិន្នន័យ / Platform Reports & Analytics
                  </h3>
                  <p className="text-xs text-purple-300/80">
                    ទាញយកទិន្នន័យលទ្ធផល និងរបាយការណ៍ហិរញ្ញវត្ថុជាឯកសារ CSV
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ទាញយករបាយការណ៍ CSV (Export CSV)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                  const count = history.filter((h) => h.number === num).length;
                  return (
                    <div
                      key={num}
                      className="rounded-xl bg-[#140f33] border border-purple-500/20 p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-300">
                          #{num} {ANIMALS_DATA[num].khmerName}
                        </div>
                        <div className="text-lg font-black text-amber-300 font-mono mt-1">
                          {count} ដង
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-lg p-0.5">
                        <AnimalArtwork number={num} className="w-full h-full object-contain" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 8: STAFF & PERMISSIONS                 */}
          {/* ========================================== */}
          {activeTab === 'staff' && (
            <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5 space-y-4">
              <div>
                <h3 className="text-base font-black text-white">
                  បុគ្គលិកគ្រប់គ្រង និងសិទ្ធិអនុញ្ញាត / Administrator Roles & Server-Enforced Permissions
                </h3>
                <p className="text-xs text-purple-300/80">
                  បញ្ជីគណនីអ្នកគ្រប់គ្រងដែលមានសិទ្ធិចូលប្រើប្រាស់ផ្ទាំងគ្រប់គ្រង
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                      <th className="py-3 px-3">Admin ID</th>
                      <th className="py-3 px-3">Username</th>
                      <th className="py-3 px-3">Display Name</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Permissions</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15">
                    {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-purple-900/20">
                        <td className="py-3 px-3 font-mono text-purple-300 font-bold">{st.id}</td>
                        <td className="py-3 px-3 font-bold text-white">{st.username}</td>
                        <td className="py-3 px-3 text-slate-200">{st.displayName}</td>
                        <td className="py-3 px-3 uppercase font-mono text-amber-300 font-bold">
                          {st.role}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {st.permissions.join(', ')}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {st.lastLogin || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 9: PLATFORM SETTINGS                   */}
          {/* ========================================== */}
          {activeTab === 'settings' && (
            <form
              onSubmit={handleSaveSettings}
              className="max-w-2xl rounded-2xl bg-[#140f33] border border-purple-500/25 p-6 space-y-4"
            >
              <h3 className="text-base font-black text-white">
                ការកំណត់ប្រព័ន្ធវេទិកា / Configurable Platform Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    រយៈពេលក្នុងមួយជុំ (វិនាទី / Round Duration)
                  </label>
                  <input
                    type="number"
                    value={platformSettings.roundDurationSeconds}
                    onChange={(e) =>
                      setPlatformSettings({
                        ...platformSettings,
                        roundDurationSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    បិទការភ្នាល់មុនពេលចេញលទ្ធផល (វិនាទី / Lockout)
                  </label>
                  <input
                    type="number"
                    value={platformSettings.bettingLockoutSeconds}
                    onChange={(e) =>
                      setPlatformSettings({
                        ...platformSettings,
                        bettingLockoutSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    ភ្នាល់អប្បបរមា (៛ / Min Bet Riel)
                  </label>
                  <input
                    type="number"
                    value={platformSettings.minBetRiel}
                    onChange={(e) =>
                      setPlatformSettings({
                        ...platformSettings,
                        minBetRiel: Number(e.target.value),
                      })
                    }
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    រយៈពេលផុតកំណត់ Session (នាទី / Session Timeout)
                  </label>
                  <input
                    type="number"
                    value={platformSettings.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setPlatformSettings({
                        ...platformSettings,
                        sessionTimeoutMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full h-10 rounded-xl bg-[#1c1545] border border-purple-400/30 px-3 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-6 h-11 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-black text-xs cursor-pointer"
              >
                រក្សាទុកការកំណត់ (Save Platform Settings)
              </button>
            </form>
          )}

          {/* ========================================== */}
          {/* TAB 10: AUDIT LOGS                         */}
          {/* ========================================== */}
          {activeTab === 'audit' && (
            <div className="rounded-2xl bg-[#140f33] border border-purple-500/25 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white">
                    កំណត់ហេតុប្រតិបត្តិការសុវត្ថិភាព / Security & Administrator Audit Logs
                  </h3>
                  <p className="text-xs text-purple-300/80">
                    កត់ត្រារាល់សកម្មភាពសំខាន់ៗដោយមិនបង្ហាញពាក្យសម្ងាត់ ឬ Token សម្ងាត់ឡើយ
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="ស្វែងរកសកម្មភាព..."
                    className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="bg-[#1c1545] border border-purple-400/30 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="ADMIN_LOGIN">ADMIN_LOGIN</option>
                    <option value="CREATE_PLAYER">CREATE_PLAYER</option>
                    <option value="UPDATE_USERNAME">UPDATE_USERNAME</option>
                    <option value="RESET_PASSWORD">RESET_PASSWORD</option>
                    <option value="DISABLE_PLAYER">DISABLE_PLAYER</option>
                    <option value="REVOKE_SESSIONS">REVOKE_SESSIONS</option>
                    <option value="SET_RESULT">SET_RESULT</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-500/20 text-slate-300 bg-[#1a1340]">
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Actor</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Target</th>
                      <th className="py-3 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15">
                    {auditLogs
                      .filter((l) => {
                        const matchAction =
                          auditActionFilter === 'ALL' || l.action === auditActionFilter;
                        const s = auditSearch.trim().toLowerCase();
                        const matchSearch =
                          !s ||
                          l.actorUsername.toLowerCase().includes(s) ||
                          l.details.toLowerCase().includes(s) ||
                          (l.targetName && l.targetName.toLowerCase().includes(s));
                        return matchAction && matchSearch;
                      })
                      .map((l) => (
                        <tr key={l.id} className="hover:bg-purple-900/20">
                          <td className="py-2.5 px-3 font-mono text-slate-300">{l.timeString}</td>
                          <td className="py-2.5 px-3 font-bold text-white">{l.actorUsername}</td>
                          <td className="py-2.5 px-3 font-mono text-purple-300">{l.actorRole}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/30 font-mono text-[11px] text-amber-300">
                              {l.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-200">
                            {l.targetName || l.targetId || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">{l.details}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* EDIT PLAYER MODAL (Save Username, Save Password, Status, Revoke Sessions) */}
      {/* ======================================================== */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            data-testid="edit-player-modal"
            className="w-full max-w-lg rounded-2xl bg-[#161038] border border-purple-400/50 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div>
                <h3 className="text-base font-black text-white">
                  កែប្រែគណនីអ្នកលេង / Edit Player Account
                </h3>
                <p className="text-xs text-purple-300">
                  Player ID: <span className="font-mono font-bold text-amber-300">{editingPlayer.id}</span> • Balance:{' '}
                  <span className="font-mono font-bold text-emerald-300">
                    {editingPlayer.balance.toLocaleString()}៛
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-only ID & Current Username */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  លេខសម្គាល់ (Current Player ID - Read Only)
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingPlayer.id}
                  className="w-full h-10 rounded-xl bg-[#0e0a24] border border-purple-500/20 px-3 text-xs font-mono text-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ឈ្មោះបច្ចុប្បន្ន (Current Username)
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingPlayer.username}
                  className="w-full h-10 rounded-xl bg-[#0e0a24] border border-purple-500/20 px-3 text-xs font-mono text-white font-bold"
                />
              </div>
            </div>

            {/* Section A: Change Username */}
            <div className="rounded-xl bg-[#1d1547] border border-purple-500/25 p-3.5 space-y-2.5">
              <label className="block text-xs font-bold text-white">
                ប្តូរឈ្មោះអ្នកប្រើប្រាស់ថ្មី (New Username)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editNewUsername}
                  onChange={(e) => setEditNewUsername(e.target.value)}
                  data-testid="edit-player-new-username"
                  placeholder="Enter new username"
                  className="flex-1 h-10 rounded-xl bg-[#110c2b] border border-purple-400/35 px-3 text-xs text-white font-mono focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isSavingEdit}
                  data-testid="save-username-btn"
                  onClick={handleSaveUsername}
                  className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
                >
                  Save Username
                </button>
              </div>
            </div>

            {/* Section B: Change / Reset Password */}
            <div className="rounded-xl bg-[#1d1547] border border-purple-500/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white">
                  ផ្លាស់ប្តូរពាក្យសម្ងាត់ថ្មី (Reset / Change Password)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const p = generateSecurePasswordString();
                    setEditNewPassword(p);
                    setEditConfirmPassword(p);
                    setShowEditPassword(true);
                  }}
                  className="text-[11px] text-amber-300 hover:underline font-semibold cursor-pointer"
                >
                  + Generate Secure Password
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative flex items-center bg-[#110c2b] border border-purple-400/35 rounded-xl px-3 h-10">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    placeholder="New Password"
                    data-testid="edit-player-new-password"
                    className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  value={editConfirmPassword}
                  onChange={(e) => setEditConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  data-testid="edit-player-confirm-password"
                  className="h-10 rounded-xl bg-[#110c2b] border border-purple-400/35 px-3 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={isSavingEdit}
                data-testid="save-new-password-btn"
                onClick={handleSaveNewPassword}
                className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Save New Password
              </button>
            </div>

            {/* Section C: Enable/Disable Account & Revoke Sessions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-500/20">
              <button
                type="button"
                data-testid="modal-toggle-status-btn"
                onClick={() => handleTogglePlayerStatus(editingPlayer)}
                className={`px-4 h-10 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                  editingPlayer.status === 'active'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Ban className="w-4 h-4" />
                <span>
                  {editingPlayer.status === 'active'
                    ? 'បិទគណនី (Disable Account)'
                    : 'បើកគណនី (Enable Account)'}
                </span>
              </button>

              <button
                type="button"
                data-testid="modal-revoke-sessions-btn"
                onClick={() => handleRevokePlayerSessions(editingPlayer)}
                className="px-4 h-10 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Revoke Sessions ({editingPlayer.activeSessionsCount ?? 0})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ONE-TIME PASSWORD DISPLAY MODAL                          */}
      {/* ======================================================== */}
      {oneTimeCredentialModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            data-testid="one-time-password-modal"
            className="w-full max-w-md rounded-2xl bg-[#18113d] border-2 border-amber-400 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-amber-300">
                {oneTimeCredentialModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setOneTimeCredentialModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#100b29] border border-purple-500/30 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Player ID:</span>
                <span className="font-mono font-bold text-purple-200">
                  {oneTimeCredentialModal.playerId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Username:</span>
                <span className="font-mono font-bold text-white">
                  {oneTimeCredentialModal.username}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-purple-500/20">
                <span className="text-slate-400">Password (Shown Once):</span>
                <span
                  data-testid="one-time-password-value"
                  className="font-mono font-black text-amber-300 text-sm"
                >
                  {oneTimeCredentialModal.password}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-amber-200/80">
              ⚠️ សូមចម្លងពាក្យសម្ងាត់នេះទុកឥឡូវនេះ។ ដើម្បីសុវត្ថិភាព ពាក្យសម្ងាត់នេះនឹងត្រូវបង្ហាញតែម្តងគត់! / Please copy this password now; it is shown only once.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Username: ${oneTimeCredentialModal.username}\nPassword: ${oneTimeCredentialModal.password}`
                  );
                  showToast('success', 'បានចម្លងទិន្នន័យគណនី! / Copied credentials.');
                }}
                className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Credentials</span>
              </button>
              <button
                type="button"
                data-testid="close-one-time-modal-btn"
                onClick={() => setOneTimeCredentialModal(null)}
                className="px-4 h-10 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW PLAYER PROFILE MODAL                                */}
      {/* ======================================================== */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#161038] border border-purple-400/50 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div>
                <h3 className="text-base font-black text-white">
                  ព័ត៌មានលម្អិតគណនីអ្នកលេង / Player Profile: {viewingProfile.player.username}
                </h3>
                <p className="text-xs text-purple-300 font-mono">
                  ID: {viewingProfile.player.id} • Status: {viewingProfile.player.status.toUpperCase()} • Balance:{' '}
                  {viewingProfile.player.balance.toLocaleString()}៛ ({formatUsd(viewingProfile.player.balance)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h4 className="text-xs font-bold text-amber-300 mb-2">
                ប្រវត្តិភ្នាល់របស់គណនីនេះ / Scoped Betting History ({viewingProfile.bets.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-xl bg-[#110c2b] border border-purple-500/20 p-2 text-xs">
                {viewingProfile.bets.length === 0 ? (
                  <div className="text-slate-400 py-3 text-center">No bets recorded yet.</div>
                ) : (
                  viewingProfile.bets.map((b) => (
                    <div
                      key={b.id}
                      className="flex justify-between py-1.5 px-2 border-b border-purple-500/10"
                    >
                      <span className="font-mono text-amber-300">{b.roundId}</span>
                      <span className="text-white">{b.bets.map((x) => x.label).join(', ')}</span>
                      <span className="font-mono text-white">{b.totalStake.toLocaleString()}៛</span>
                      <span className="uppercase font-bold text-purple-300">{b.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-emerald-300 mb-2">
                ប្រវត្តិដាក់/ដកប្រាក់ / Scoped Transaction History ({viewingProfile.transactions.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-xl bg-[#110c2b] border border-purple-500/20 p-2 text-xs">
                {viewingProfile.transactions.length === 0 ? (
                  <div className="text-slate-400 py-3 text-center">No transactions recorded yet.</div>
                ) : (
                  viewingProfile.transactions.map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between py-1.5 px-2 border-b border-purple-500/10"
                    >
                      <span className="font-mono text-slate-300">{t.id}</span>
                      <span className="uppercase text-white font-bold">{t.type}</span>
                      <span className="font-mono text-emerald-300">{t.amount.toLocaleString()}៛</span>
                      <span className="uppercase text-purple-300">{t.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
