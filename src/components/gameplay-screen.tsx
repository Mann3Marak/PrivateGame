'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useGameStore } from '@/src/lib/game/store';
import { NopeAlternative, Player, RandomAction, Round, SpinResultItem } from '@/src/lib/game/types';
import { PAGE_CONTAINER_CLASS } from '@/src/lib/ui/layout';

const DEFAULT_OVERLAY_TIMER_SECONDS = 10;
const TIMER_FLASH_INTERVAL_MS = 420;
const TIMER_FLASH_TOGGLES = 6;
const REEL_STOP_PULSE_MS = 420;
const REEL_SPIN_DURATION_MS = 1400;
const REEL_GAP_MS = 220;
const RANDOM_INSTRUCTION_CHANCE = 1;
const RANDOM_INSTRUCTION_MIN_SPINS_BETWEEN = 1;
const PLAYER_IMAGE_FRAME_SIZE_CLASS = 'h-44 w-32 xl:h-56 xl:w-40 2xl:h-64 2xl:w-44';

type ReelKey = 'part' | 'action' | 'timer';

function getOpponent(player: Player): Player {
  return player === 'P1' ? 'P2' : 'P1';
}

function buildReelItems(pool: string[], fallback: string): string[] {
  const values = pool.length > 0 ? pool : [fallback];
  return [...values, ...values, ...values];
}

function resolveTimerSeconds(timerSeconds: number | null | undefined, timerUnit: 'seconds' | 'minutes' | null | undefined): number {
  if (!timerSeconds) return 0;
  return timerUnit === 'minutes' ? timerSeconds * 60 : timerSeconds;
}

function parseTimerSeconds(rawText: string | null | undefined): number {
  if (!rawText) {
    return DEFAULT_OVERLAY_TIMER_SECONDS;
  }

  const text = rawText.trim().toLowerCase();
  if (!text) {
    return DEFAULT_OVERLAY_TIMER_SECONDS;
  }

  let totalSeconds = 0;
  let hasUnitMatch = false;

  const minuteMatches = text.matchAll(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/g);
  for (const match of minuteMatches) {
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) {
      totalSeconds += Math.round(value * 60);
      hasUnitMatch = true;
    }
  }

  const secondMatches = text.matchAll(/(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)\b/g);
  for (const match of secondMatches) {
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) {
      totalSeconds += Math.round(value);
      hasUnitMatch = true;
    }
  }

  if (hasUnitMatch && totalSeconds > 0) {
    return totalSeconds;
  }

  const fallbackNumberMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (fallbackNumberMatch) {
    const numericValue = Number.parseFloat(fallbackNumberMatch[1]);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return Math.round(numericValue);
    }
  }

  return DEFAULT_OVERLAY_TIMER_SECONDS;
}

interface RandomInstructionPick {
  action: RandomAction;
  index: number;
}

function pickRandomInstruction(
  actions: RandomAction[],
  activePlayer: Player,
  completedIndices: number[]
): RandomInstructionPick | null {
  const doneSet = new Set(completedIndices);
  const candidates: RandomInstructionPick[] = actions
    .map((action, originalIndex) => ({
      action: {
        text: action.text.trim(),
        imageRef: action.imageRef,
        linkUrl: action.linkUrl?.trim() || null,
        assignedPlayer: action.assignedPlayer ?? 'any',
        timerSeconds: action.timerSeconds ?? null,
        timerUnit: action.timerUnit ?? 'seconds',
        secondStep: action.secondStep ?? null,
        nopeAlternative: action.nopeAlternative ?? null
      },
      index: originalIndex
    }))
    .filter(({ action, index }) => {
      if (doneSet.has(index)) {
        return false;
      }
      const hasContent = action.text.length > 0 || Boolean(action.imageRef) || Boolean(action.linkUrl);
      if (!hasContent) {
        return false;
      }
      return action.assignedPlayer === 'any' || action.assignedPlayer === activePlayer;
    });
  if (candidates.length === 0) {
    return null;
  }

  if (Math.random() > RANDOM_INSTRUCTION_CHANCE) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function toYouTubeEmbedUrl(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = parsed.pathname.replace('/', '').trim();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }

      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function SpinResultCard({
  label,
  item,
  pool,
  isSpinning,
  shouldPulseOnLand,
  isRevealed
}: {
  label: 'Body Part' | 'Action' | 'Timer';
  item: SpinResultItem | null;
  pool: string[];
  isSpinning: boolean;
  shouldPulseOnLand: boolean;
  isRevealed: boolean;
}) {
  const reelItems = buildReelItems(pool, label);
  const spinStyle = {
    '--slot-spin-duration': `${REEL_SPIN_DURATION_MS}ms`,
    '--slot-spin-delay': '0ms'
  } as CSSProperties;

  return (
    <article className="rounded-xl border border-[#d4af37]/40 bg-[#f5e6d3]/35 p-3 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-[#5e2a4d]">{label}</h2>
      <div
        className={`slot-window relative mt-2 h-28 overflow-hidden rounded-lg border-2 px-2 py-1 ${
          isSpinning
            ? 'slot-window--spinning border-[#d4af37]/90'
            : shouldPulseOnLand
              ? 'slot-window--landed border-[#f5e6d3]'
              : 'slot-window--idle border-[#f5e6d3]/70'
        }`}
      >
        {isSpinning ? (
          <div className="slot-reel-track slot-reel-track--spinning" style={spinStyle}>
            {reelItems.map((text, index) => (
              <div className="slot-cell text-center text-sm font-semibold text-[#fadadd]" key={`${label}-${text}-${index}`}>
                {text}
              </div>
            ))}
          </div>
        ) : (
          <div className="slot-cell h-full text-center text-sm font-semibold text-[#fadadd]">
            {isRevealed ? item?.text ?? label : label}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-[#2f1530] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#2f1530] to-transparent" />
        <div
          className={`pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded border ${
            isSpinning
              ? 'border-[#f5e6d3] bg-[#f5e6d3]/10'
              : shouldPulseOnLand
                ? 'slot-payline--landed border-[#f5e6d3] bg-[#f5e6d3]/15'
                : 'border-[#d4af37]/80 bg-[#d4af37]/10'
          }`}
        />
      </div>
      <p className="mt-2 text-sm text-[#5e2a4d]">
        {isSpinning ? 'Spinning...' : isRevealed ? `Result: ${item?.text ?? label}` : 'Waiting...'}
      </p>
    </article>
  );
}

function OverlayResultCard({ label, item }: { label: 'Body Part' | 'Action' | 'Timer'; item: SpinResultItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.imageRef) && !imageFailed;

  return (
    <article className="rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/70 p-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">{label}</p>
      {hasImage ? (
        <div className="relative mt-4 h-44 overflow-hidden rounded border border-[#d4af37]/50 bg-[#3a1a30]">
          <Image
            alt={`${label} overlay result`}
            className="object-contain"
            fill
            onError={() => setImageFailed(true)}
            sizes="(max-width: 768px) 100vw, 33vw"
            src={item.imageRef ?? ''}
          />
        </div>
      ) : null}
      <p className="mt-4 text-3xl font-bold text-[#f5e6d3]">{item.text}</p>
    </article>
  );
}

export function GameplayScreen() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [showRulesOverlay, setShowRulesOverlay] = useState(false);
  const [showRandomInstructionOverlay, setShowRandomInstructionOverlay] = useState(false);
  const [showRoundIntroOverlay, setShowRoundIntroOverlay] = useState(false);
  const [showNopeTaskOverlay, setShowNopeTaskOverlay] = useState(false);
  const [activeNopeTask, setActiveNopeTask] = useState<NopeAlternative | null>(null);
  const [nopeTaskImageFailed, setNopeTaskImageFailed] = useState(false);
  const [activeRandomInstruction, setActiveRandomInstruction] = useState<RandomAction | null>(null);
  const [activeRandomInstructionIndex, setActiveRandomInstructionIndex] = useState<number | null>(null);
  const [randomInstructionStep, setRandomInstructionStep] = useState<1 | 2>(1);
  const [randomInstructionStepImageFailed, setRandomInstructionStepImageFailed] = useState(false);
  const [activeRoundIntro, setActiveRoundIntro] = useState<Round | null>(null);
  const [pendingRandomInstruction, setPendingRandomInstruction] = useState<RandomAction | null>(null);
  const [pendingRandomInstructionIndex, setPendingRandomInstructionIndex] = useState<number | null>(null);
  const [pendingRandomInstructionRoundNumber, setPendingRandomInstructionRoundNumber] = useState<number | null>(null);
  const [activeRandomInstructionRoundNumber, setActiveRandomInstructionRoundNumber] = useState<number | null>(null);
  const [spinningPlayer, setSpinningPlayer] = useState<Player | null>(null);
  const [failedImageMap, setFailedImageMap] = useState<Record<string, boolean>>({});
  const [randomInstructionImageFailed, setRandomInstructionImageFailed] = useState(false);
  const [overlayTimerSeconds, setOverlayTimerSeconds] = useState(DEFAULT_OVERLAY_TIMER_SECONDS);
  const [overlaySecondsLeft, setOverlaySecondsLeft] = useState(DEFAULT_OVERLAY_TIMER_SECONDS);
  const [isOverlayTimerRunning, setIsOverlayTimerRunning] = useState(false);
  const [isTimerFlashing, setIsTimerFlashing] = useState(false);
  const [isTimerFlashOn, setIsTimerFlashOn] = useState(false);
  const [nopeSecondsLeft, setNopeSecondsLeft] = useState(0);
  const [isNopeTimerRunning, setIsNopeTimerRunning] = useState(false);
  const [isNopeTimerFlashing, setIsNopeTimerFlashing] = useState(false);
  const [isNopeTimerFlashOn, setIsNopeTimerFlashOn] = useState(false);
  const [randomInstructionSecondsLeft, setRandomInstructionSecondsLeft] = useState(0);
  const [isRandomInstructionTimerRunning, setIsRandomInstructionTimerRunning] = useState(false);
  const [isRandomInstructionTimerFlashing, setIsRandomInstructionTimerFlashing] = useState(false);
  const [isRandomInstructionTimerFlashOn, setIsRandomInstructionTimerFlashOn] = useState(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);
  const [gameOverAction, setGameOverAction] = useState<string>('');
  const [gameOverTimerSeconds, setGameOverTimerSeconds] = useState(0);
  const [gameOverTimerUnit, setGameOverTimerUnit] = useState<'seconds' | 'minutes'>('seconds');
  const [gameOverSecondsLeft, setGameOverSecondsLeft] = useState(0);
  const [isGameOverTimerRunning, setIsGameOverTimerRunning] = useState(false);
  const [isGameOverTimerFlashing, setIsGameOverTimerFlashing] = useState(false);
  const [isGameOverTimerFlashOn, setIsGameOverTimerFlashOn] = useState(false);
  const spinsSinceRandomInstructionRef = useRef(999);
  const shownRoundIntrosRef = useRef<Set<number>>(new Set());
  const pendingActionOnlyAdvanceRef = useRef<Player | null>(null);
  const spinTimelineTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const overlayTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayFlashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nopeTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nopeFlashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const randomInstructionTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const randomInstructionFlashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameOverTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameOverFlashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerEndSoundRef = useRef<HTMLAudioElement | null>(null);
  const roundIntroSoundRef = useRef<HTMLAudioElement | null>(null);
  const randomActionSoundRef = useRef<HTMLAudioElement | null>(null);
  const reelStopTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [reelIsSpinning, setReelIsSpinning] = useState<Record<ReelKey, boolean>>({
    part: false,
    action: false,
    timer: false
  });
  const [reelIsRevealed, setReelIsRevealed] = useState<Record<ReelKey, boolean>>({
    part: true,
    action: true,
    timer: true
  });
  const [reelStopPulse, setReelStopPulse] = useState<Record<ReelKey, boolean>>({
    part: false,
    action: false,
    timer: false
  });
  const game = useGameStore((state) => state.game);
  const recoveryNotice = useGameStore((state) => state.recoveryNotice);
  const spinError = useGameStore((state) => state.spinError);
  const hydrateFromCloud = useGameStore((state) => state.hydrateFromCloud);
  const spin = useGameStore((state) => state.spin);
  const advanceActionTurn = useGameStore((state) => state.advanceActionTurn);
  const markRandomInstructionDone = useGameStore((state) => state.markRandomInstructionDone);
  const restartGame = useGameStore((state) => state.restartGame);
  const pause = useGameStore((state) => state.pause);
  const resume = useGameStore((state) => state.resume);

  const currentRound = game.rounds.find((round) => round.roundNumber === game.session.currentRoundNumber) ?? game.rounds[0];
  const isLastRound = game.session.currentRoundNumber === game.rounds[game.rounds.length - 1]?.roundNumber;
  const isActionsOnlyRound = currentRound.mode === 'actions-only';
  const roundCounter = game.session.turnCounters[String(currentRound.roundNumber)] ?? { P1: 0, P2: 0 };
  const roundTotalLimit = currentRound.totalTurns > 0 ? currentRound.totalTurns : currentRound.quotaPerPlayer * 2;
  const isGameComplete = isLastRound && (roundCounter.P1 + roundCounter.P2) >= roundTotalLimit;
  const sideVideoEmbedUrl = toYouTubeEmbedUrl(game.sideVideoUrl);
  const activeRoundIntroImageRef = activeRoundIntro?.introImageRef ?? null;
  const resultActionPlayer = getOpponent(game.session.activePlayer);
  const resultActionImage = game.playerImages[resultActionPlayer];
  const resultActionImageFailed = Boolean(resultActionImage && failedImageMap[resultActionImage]);
  const currentSpinnerPlayer = isSpinning && spinningPlayer ? spinningPlayer : game.session.activePlayer;
  const nextSpinnerPlayer = getOpponent(currentSpinnerPlayer);
  const currentSpinnerImage = game.playerImages[currentSpinnerPlayer];
  const nextSpinnerImage = game.playerImages[nextSpinnerPlayer];
  const currentSpinnerImageFailed = Boolean(currentSpinnerImage && failedImageMap[currentSpinnerImage]);
  const nextSpinnerImageFailed = Boolean(nextSpinnerImage && failedImageMap[nextSpinnerImage]);

  const playTimerFallbackBeep = () => {
    if (typeof window === 'undefined' || game.audioSettings.muted) {
      return;
    }

    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 880;
    gainNode.gain.value = Math.max(0.05, Math.min(game.audioSettings.volume, 1)) * 0.18;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      void audioContext.close();
    }, 220);
  };

  const playGameAudio = async (kind: 'timer' | 'round' | 'random') => {
    if (game.audioSettings.muted) {
      return;
    }

    const sourceUrl =
      kind === 'timer'
        ? game.audioSettings.timerEndAudioRef
        : kind === 'round'
          ? game.audioSettings.roundIntroAudioRef
          : game.audioSettings.randomActionAudioRef;
    if (!sourceUrl) {
      if (kind === 'timer') {
        playTimerFallbackBeep();
      }
      return;
    }

    const targetRef = kind === 'timer' ? timerEndSoundRef : kind === 'round' ? roundIntroSoundRef : randomActionSoundRef;
    if (!targetRef.current || targetRef.current.src !== sourceUrl) {
      targetRef.current = new Audio(sourceUrl);
    }

    try {
      targetRef.current.currentTime = 0;
      targetRef.current.volume = Math.max(0, Math.min(game.audioSettings.volume, 1));
      await targetRef.current.play();
    } catch {
      if (kind === 'timer') {
        playTimerFallbackBeep();
      }
    }
  };

  useEffect(() => {
    void hydrateFromCloud();
  }, [hydrateFromCloud]);

  // Fire the round intro proactively when we enter a fresh round, so the announcement
  // modal pauses the game before the first action of that round. "Fresh" = both player
  // counters are still zero for the round (true on a new game, on restart, and when the
  // previous round's quota just advanced us here). We wait for any in-flight overlay to
  // close first so the intro does not stack on top.
  useEffect(() => {
    const roundNumber = game.session.currentRoundNumber;
    if (shownRoundIntrosRef.current.has(roundNumber)) {
      return;
    }
    if (showResultOverlay || showRandomInstructionOverlay || showNopeTaskOverlay || isSpinning) {
      return;
    }
    const counters = game.session.turnCounters[String(roundNumber)] ?? { P1: 0, P2: 0 };
    if (counters.P1 !== 0 || counters.P2 !== 0) {
      return;
    }
    const round = game.rounds.find((candidate) => candidate.roundNumber === roundNumber);
    if (!round) {
      return;
    }
    shownRoundIntrosRef.current.add(roundNumber);
    setActiveRoundIntro(round);
    setShowRoundIntroOverlay(true);
    void playGameAudio('round');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    game.session.currentRoundNumber,
    showResultOverlay,
    showRandomInstructionOverlay,
    showNopeTaskOverlay,
    isSpinning
  ]);

  useEffect(() => {
    return () => {
      spinTimelineTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      spinTimelineTimeoutsRef.current = [];
      if (overlayTickIntervalRef.current) {
        clearInterval(overlayTickIntervalRef.current);
      }
      if (overlayFlashIntervalRef.current) {
        clearInterval(overlayFlashIntervalRef.current);
      }
      if (nopeTickIntervalRef.current) {
        clearInterval(nopeTickIntervalRef.current);
      }
      if (nopeFlashIntervalRef.current) {
        clearInterval(nopeFlashIntervalRef.current);
      }
      if (randomInstructionTickIntervalRef.current) {
        clearInterval(randomInstructionTickIntervalRef.current);
      }
      if (randomInstructionFlashIntervalRef.current) {
        clearInterval(randomInstructionFlashIntervalRef.current);
      }
      if (gameOverTickIntervalRef.current) {
        clearInterval(gameOverTickIntervalRef.current);
      }
      if (gameOverFlashIntervalRef.current) {
        clearInterval(gameOverFlashIntervalRef.current);
      }
      reelStopTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      reelStopTimeoutsRef.current = [];
      if (timerEndSoundRef.current) {
        timerEndSoundRef.current.pause();
        timerEndSoundRef.current = null;
      }
      if (roundIntroSoundRef.current) {
        roundIntroSoundRef.current.pause();
        roundIntroSoundRef.current = null;
      }
      if (randomActionSoundRef.current) {
        randomActionSoundRef.current.pause();
        randomActionSoundRef.current = null;
      }
    };
  }, []);

  const clearReelStopTimeouts = () => {
    reelStopTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    reelStopTimeoutsRef.current = [];
  };

  const clearSpinTimelineTimeouts = () => {
    spinTimelineTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    spinTimelineTimeoutsRef.current = [];
  };

  const scheduleTimeline = (delayMs: number, run: () => void) => {
    const timeout = setTimeout(run, delayMs);
    spinTimelineTimeoutsRef.current.push(timeout);
  };

  const triggerReelStopPulse = (reelKey: ReelKey) => {
    setReelStopPulse((previous) => ({ ...previous, [reelKey]: true }));
    const endTimeout = setTimeout(() => {
      setReelStopPulse((previous) => ({ ...previous, [reelKey]: false }));
    }, REEL_STOP_PULSE_MS);
    reelStopTimeoutsRef.current.push(endTimeout);
  };

  const runSequentialSpinTimeline = () => {
    const partStart = 0;
    const partStop = partStart + REEL_SPIN_DURATION_MS;
    const actionStart = partStop + REEL_GAP_MS;
    const actionStop = actionStart + REEL_SPIN_DURATION_MS;
    const timerStart = actionStop + REEL_GAP_MS;
    const timerStop = timerStart + REEL_SPIN_DURATION_MS;
    const allDone = timerStop + 200;

    scheduleTimeline(partStart, () => {
      setReelIsSpinning((previous) => ({ ...previous, part: true }));
    });
    scheduleTimeline(partStop, () => {
      setReelIsSpinning((previous) => ({ ...previous, part: false }));
      setReelIsRevealed((previous) => ({ ...previous, part: true }));
      triggerReelStopPulse('part');
    });

    scheduleTimeline(actionStart, () => {
      setReelIsSpinning((previous) => ({ ...previous, action: true }));
    });
    scheduleTimeline(actionStop, () => {
      setReelIsSpinning((previous) => ({ ...previous, action: false }));
      setReelIsRevealed((previous) => ({ ...previous, action: true }));
      triggerReelStopPulse('action');
    });

    scheduleTimeline(timerStart, () => {
      setReelIsSpinning((previous) => ({ ...previous, timer: true }));
    });
    scheduleTimeline(timerStop, () => {
      setReelIsSpinning((previous) => ({ ...previous, timer: false }));
      setReelIsRevealed((previous) => ({ ...previous, timer: true }));
      triggerReelStopPulse('timer');
    });

    scheduleTimeline(allDone, () => {
      setIsSpinning(false);
      setShowResultOverlay(true);
    });
  };

  const clearOverlayIntervals = () => {
    if (overlayTickIntervalRef.current) {
      clearInterval(overlayTickIntervalRef.current);
      overlayTickIntervalRef.current = null;
    }
    if (overlayFlashIntervalRef.current) {
      clearInterval(overlayFlashIntervalRef.current);
      overlayFlashIntervalRef.current = null;
    }
  };

  const showNextQueuedOverlay = (options?: { skipRandomInstruction?: boolean }) => {
    if (!options?.skipRandomInstruction && pendingRandomInstruction) {
      clearRandomInstructionTimerIntervals();
      setIsRandomInstructionTimerRunning(false);
      setIsRandomInstructionTimerFlashing(false);
      setIsRandomInstructionTimerFlashOn(false);
      // Step 1 uses the base action's own timer; Step 2 (if present) primes its own
      // timer when the player advances via onNextRandomInstructionStep.
      setRandomInstructionSecondsLeft(resolveTimerSeconds(pendingRandomInstruction.timerSeconds, pendingRandomInstruction.timerUnit));
      setRandomInstructionImageFailed(false);
      setRandomInstructionStepImageFailed(false);
      setRandomInstructionStep(1);
      setActiveRandomInstruction(pendingRandomInstruction);
      setActiveRandomInstructionIndex(pendingRandomInstructionIndex);
      setActiveRandomInstructionRoundNumber(pendingRandomInstructionRoundNumber);
      setShowRandomInstructionOverlay(true);
      void playGameAudio('random');
      setPendingRandomInstruction(null);
      setPendingRandomInstructionIndex(null);
      setPendingRandomInstructionRoundNumber(null);
    }
  };

  const clearGameOverTimerIntervals = () => {
    if (gameOverTickIntervalRef.current) {
      clearInterval(gameOverTickIntervalRef.current);
      gameOverTickIntervalRef.current = null;
    }
    if (gameOverFlashIntervalRef.current) {
      clearInterval(gameOverFlashIntervalRef.current);
      gameOverFlashIntervalRef.current = null;
    }
  };

  const startGameOverTimerFlashAndFinish = () => {
    clearGameOverTimerIntervals();
    setIsGameOverTimerRunning(false);
    setIsGameOverTimerFlashing(true);
    setIsGameOverTimerFlashOn(true);

    let togglesRemaining = TIMER_FLASH_TOGGLES;
    gameOverFlashIntervalRef.current = setInterval(() => {
      setIsGameOverTimerFlashOn((previous) => !previous);
      togglesRemaining -= 1;
      if (togglesRemaining <= 0) {
        if (gameOverFlashIntervalRef.current) {
          clearInterval(gameOverFlashIntervalRef.current);
          gameOverFlashIntervalRef.current = null;
        }
        setIsGameOverTimerFlashing(false);
        setIsGameOverTimerFlashOn(false);
        void playGameAudio('timer');
      }
    }, TIMER_FLASH_INTERVAL_MS);
  };

  const startGameOverTimer = () => {
    if (isGameOverTimerRunning || isGameOverTimerFlashing || !gameOverTimerSeconds) {
      return;
    }
    clearGameOverTimerIntervals();
    setGameOverSecondsLeft(gameOverTimerSeconds);
    setIsGameOverTimerRunning(true);
    gameOverTickIntervalRef.current = setInterval(() => {
      setGameOverSecondsLeft((previous) => {
        if (previous <= 1) {
          startGameOverTimerFlashAndFinish();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const closeGameOverOverlay = () => {
    clearGameOverTimerIntervals();
    setIsGameOverTimerRunning(false);
    setIsGameOverTimerFlashing(false);
    setIsGameOverTimerFlashOn(false);
    setShowGameOverOverlay(false);
  };

  const closeResultOverlay = (options?: { skipRandomInstruction?: boolean; skipGameOver?: boolean }) => {
    clearOverlayIntervals();
    setIsOverlayTimerRunning(false);
    setIsTimerFlashing(false);
    setIsTimerFlashOn(false);
    setShowResultOverlay(false);
    if (!options?.skipGameOver && isGameComplete) {
      const challenge = game.gameOverChallenge;
      const actionText = challenge?.actionText?.trim() || 'One final act together...';
      const timerSecs = challenge?.timerSeconds
        ? resolveTimerSeconds(challenge.timerSeconds, challenge.timerUnit)
        : DEFAULT_OVERLAY_TIMER_SECONDS;
      setGameOverAction(actionText);
      setGameOverTimerSeconds(timerSecs);
      setGameOverTimerUnit(challenge?.timerUnit ?? 'seconds');
      setGameOverSecondsLeft(timerSecs);
      clearGameOverTimerIntervals();
      setIsGameOverTimerRunning(false);
      setIsGameOverTimerFlashing(false);
      setIsGameOverTimerFlashOn(false);
      setShowGameOverOverlay(true);
      return;
    }
    showNextQueuedOverlay(options);
  };

  const startTimerFlashAndClose = () => {
    clearOverlayIntervals();
    setIsOverlayTimerRunning(false);
    setIsTimerFlashing(true);
    setIsTimerFlashOn(true);

    let togglesRemaining = TIMER_FLASH_TOGGLES;
    overlayFlashIntervalRef.current = setInterval(() => {
      setIsTimerFlashOn((previous) => !previous);
      togglesRemaining -= 1;

      if (togglesRemaining <= 0) {
        if (overlayFlashIntervalRef.current) {
          clearInterval(overlayFlashIntervalRef.current);
          overlayFlashIntervalRef.current = null;
        }
        setIsTimerFlashing(false);
        setIsTimerFlashOn(false);
        void playGameAudio('timer');
        closeResultOverlay();
      }
    }, TIMER_FLASH_INTERVAL_MS);
  };

  const clearNopeTimerIntervals = () => {
    if (nopeTickIntervalRef.current) {
      clearInterval(nopeTickIntervalRef.current);
      nopeTickIntervalRef.current = null;
    }
    if (nopeFlashIntervalRef.current) {
      clearInterval(nopeFlashIntervalRef.current);
      nopeFlashIntervalRef.current = null;
    }
  };

  const clearRandomInstructionTimerIntervals = () => {
    if (randomInstructionTickIntervalRef.current) {
      clearInterval(randomInstructionTickIntervalRef.current);
      randomInstructionTickIntervalRef.current = null;
    }
    if (randomInstructionFlashIntervalRef.current) {
      clearInterval(randomInstructionFlashIntervalRef.current);
      randomInstructionFlashIntervalRef.current = null;
    }
  };

  const startRandomInstructionTimerFlashAndFinish = () => {
    clearRandomInstructionTimerIntervals();
    setIsRandomInstructionTimerRunning(false);
    setIsRandomInstructionTimerFlashing(true);
    setIsRandomInstructionTimerFlashOn(true);

    let togglesRemaining = TIMER_FLASH_TOGGLES;
    randomInstructionFlashIntervalRef.current = setInterval(() => {
      setIsRandomInstructionTimerFlashOn((previous) => !previous);
      togglesRemaining -= 1;

      if (togglesRemaining <= 0) {
        if (randomInstructionFlashIntervalRef.current) {
          clearInterval(randomInstructionFlashIntervalRef.current);
          randomInstructionFlashIntervalRef.current = null;
        }
        setIsRandomInstructionTimerFlashing(false);
        setIsRandomInstructionTimerFlashOn(false);
        void playGameAudio('timer');
      }
    }, TIMER_FLASH_INTERVAL_MS);
  };

  const startRandomInstructionTimer = () => {
    if (!activeRandomInstruction) {
      return;
    }
    // Step 1 uses the base action's own timer; Step 2 uses its own timer.
    const effectiveSource =
      randomInstructionStep === 2 && activeRandomInstruction.secondStep
        ? activeRandomInstruction.secondStep
        : activeRandomInstruction;
    const effectiveTimerSeconds = resolveTimerSeconds(effectiveSource.timerSeconds, effectiveSource.timerUnit);
    if (!effectiveTimerSeconds || isRandomInstructionTimerRunning || isRandomInstructionTimerFlashing) {
      return;
    }

    clearRandomInstructionTimerIntervals();
    setRandomInstructionSecondsLeft(effectiveTimerSeconds);
    setIsRandomInstructionTimerRunning(true);
    randomInstructionTickIntervalRef.current = setInterval(() => {
      setRandomInstructionSecondsLeft((previous) => {
        if (previous <= 1) {
          startRandomInstructionTimerFlashAndFinish();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const onNextRandomInstructionStep = () => {
    if (!activeRandomInstruction?.secondStep || randomInstructionStep !== 1) {
      return;
    }
    clearRandomInstructionTimerIntervals();
    setIsRandomInstructionTimerRunning(false);
    setIsRandomInstructionTimerFlashing(false);
    setIsRandomInstructionTimerFlashOn(false);
    setRandomInstructionSecondsLeft(resolveTimerSeconds(activeRandomInstruction.secondStep.timerSeconds, activeRandomInstruction.secondStep.timerUnit));
    setRandomInstructionStepImageFailed(false);
    setRandomInstructionStep(2);
  };

  const dismissRandomInstruction = () => {
    // Per product rules: an action is only marked done once the player finishes Step 2
    // (or finishes a single-step action). Closing a two-step action mid-flow leaves it
    // in the pool.
    const hasSecondStep = Boolean(activeRandomInstruction?.secondStep);
    const isFinalDismissal = !hasSecondStep || randomInstructionStep === 2;
    if (
      isFinalDismissal &&
      activeRandomInstructionRoundNumber != null &&
      activeRandomInstructionIndex != null
    ) {
      markRandomInstructionDone(activeRandomInstructionRoundNumber, activeRandomInstructionIndex);
    }
    clearRandomInstructionTimerIntervals();
    setIsRandomInstructionTimerRunning(false);
    setIsRandomInstructionTimerFlashing(false);
    setIsRandomInstructionTimerFlashOn(false);
    setRandomInstructionSecondsLeft(0);
    setRandomInstructionImageFailed(false);
    setRandomInstructionStepImageFailed(false);
    setRandomInstructionStep(1);
    setShowRandomInstructionOverlay(false);
    setActiveRandomInstruction(null);
    setActiveRandomInstructionIndex(null);
    setActiveRandomInstructionRoundNumber(null);
    // In actions-only rounds, a full dismissal (without a Nope detour) advances the turn.
    if (isFinalDismissal && pendingActionOnlyAdvanceRef.current) {
      const player = pendingActionOnlyAdvanceRef.current;
      pendingActionOnlyAdvanceRef.current = null;
      advanceActionTurn(player);
    }
  };

  const onNopeRandomInstruction = () => {
    if (!activeRandomInstruction?.nopeAlternative) {
      return;
    }
    const nopeAlternative = activeRandomInstruction.nopeAlternative;
    // Preserve the action-only pending advance across the Nope detour; the advance fires
    // when the Nope overlay closes, not when the random instruction dismisses.
    const preservedActionOnlyPlayer = pendingActionOnlyAdvanceRef.current;
    dismissRandomInstruction();
    pendingActionOnlyAdvanceRef.current = preservedActionOnlyPlayer;
    clearNopeTimerIntervals();
    setIsNopeTimerRunning(false);
    setIsNopeTimerFlashing(false);
    setIsNopeTimerFlashOn(false);
    setNopeSecondsLeft(resolveTimerSeconds(nopeAlternative.timerSeconds, nopeAlternative.timerUnit));
    setActiveNopeTask(nopeAlternative);
    setNopeTaskImageFailed(false);
    setShowNopeTaskOverlay(true);
  };

  const closeNopeTaskOverlay = () => {
    clearNopeTimerIntervals();
    setIsNopeTimerRunning(false);
    setIsNopeTimerFlashing(false);
    setIsNopeTimerFlashOn(false);
    setShowNopeTaskOverlay(false);
    setActiveNopeTask(null);
    setNopeTaskImageFailed(false);
    if (pendingActionOnlyAdvanceRef.current) {
      const player = pendingActionOnlyAdvanceRef.current;
      pendingActionOnlyAdvanceRef.current = null;
      advanceActionTurn(player);
    }
  };

  const startNopeTimerFlashAndFinish = () => {
    clearNopeTimerIntervals();
    setIsNopeTimerRunning(false);
    setIsNopeTimerFlashing(true);
    setIsNopeTimerFlashOn(true);

    let togglesRemaining = TIMER_FLASH_TOGGLES;
    nopeFlashIntervalRef.current = setInterval(() => {
      setIsNopeTimerFlashOn((previous) => !previous);
      togglesRemaining -= 1;

      if (togglesRemaining <= 0) {
        if (nopeFlashIntervalRef.current) {
          clearInterval(nopeFlashIntervalRef.current);
          nopeFlashIntervalRef.current = null;
        }
        setIsNopeTimerFlashing(false);
        setIsNopeTimerFlashOn(false);
        void playGameAudio('timer');
      }
    }, TIMER_FLASH_INTERVAL_MS);
  };

  const startNopeTimer = () => {
    if (!activeNopeTask?.timerSeconds || isNopeTimerRunning || isNopeTimerFlashing) {
      return;
    }

    clearNopeTimerIntervals();
    setNopeSecondsLeft(activeNopeTask.timerSeconds);
    setIsNopeTimerRunning(true);
    nopeTickIntervalRef.current = setInterval(() => {
      setNopeSecondsLeft((previous) => {
        if (previous <= 1) {
          startNopeTimerFlashAndFinish();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const startOverlayTimer = () => {
    if (isOverlayTimerRunning || isTimerFlashing || !showResultOverlay) {
      return;
    }

    clearOverlayIntervals();
    setOverlaySecondsLeft(overlayTimerSeconds);
    setIsOverlayTimerRunning(true);
    overlayTickIntervalRef.current = setInterval(() => {
      setOverlaySecondsLeft((previous) => {
        if (previous <= 1) {
          startTimerFlashAndClose();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const onSpin = () => {
    const preSpinRoundNumber = game.session.currentRoundNumber;
    const preSpinRound = game.rounds.find((round) => round.roundNumber === preSpinRoundNumber) ?? game.rounds[0];
    const playerWhoSpins = game.session.activePlayer;
    const outcome = spin(playerWhoSpins);
    if (outcome.ok) {
      setSpinningPlayer(playerWhoSpins);
      const postSpinRoundNumber = useGameStore.getState().game.session.currentRoundNumber;
      const roundAdvanced = postSpinRoundNumber !== preSpinRoundNumber;
      spinsSinceRandomInstructionRef.current += 1;
      const preTurnCount =
        (game.session.turnCounters[String(preSpinRoundNumber)]?.P1 ?? 0) +
        (game.session.turnCounters[String(preSpinRoundNumber)]?.P2 ?? 0);
      const isFirstSpinOfRound1 = preSpinRoundNumber === 1 && preTurnCount === 0;
      const canShowRandomInstruction =
        !roundAdvanced && !isFirstSpinOfRound1 && spinsSinceRandomInstructionRef.current > RANDOM_INSTRUCTION_MIN_SPINS_BETWEEN;
      const completedForRound =
        game.session.completedRandomInstructions?.[String(preSpinRoundNumber)] ?? [];
      const randomInstructionPick = canShowRandomInstruction
        ? pickRandomInstruction(preSpinRound.randomActions, playerWhoSpins, completedForRound)
        : null;
      if (randomInstructionPick) {
        spinsSinceRandomInstructionRef.current = 0;
      }
      clearSpinTimelineTimeouts();
      clearReelStopTimeouts();
      setReelIsSpinning({ part: false, action: false, timer: false });
      setReelIsRevealed({ part: false, action: false, timer: false });
      setReelStopPulse({ part: false, action: false, timer: false });
      const seconds = parseTimerSeconds(outcome.result.timer.text);
      clearOverlayIntervals();
      setOverlayTimerSeconds(seconds);
      setOverlaySecondsLeft(seconds);
      setIsOverlayTimerRunning(false);
      setIsTimerFlashing(false);
      setIsTimerFlashOn(false);
      setRandomInstructionImageFailed(false);
      setRandomInstructionStepImageFailed(false);
      setRandomInstructionStep(1);
      setShowRandomInstructionOverlay(false);
      setActiveRandomInstruction(null);
      setActiveRandomInstructionIndex(null);
      setActiveRandomInstructionRoundNumber(null);
      clearRandomInstructionTimerIntervals();
      setIsRandomInstructionTimerRunning(false);
      setIsRandomInstructionTimerFlashing(false);
      setIsRandomInstructionTimerFlashOn(false);
      setRandomInstructionSecondsLeft(0);
      setShowRoundIntroOverlay(false);
      setShowNopeTaskOverlay(false);
      setActiveNopeTask(null);
      setNopeTaskImageFailed(false);
      clearNopeTimerIntervals();
      setIsNopeTimerRunning(false);
      setIsNopeTimerFlashing(false);
      setIsNopeTimerFlashOn(false);
      setNopeSecondsLeft(0);
      setPendingRandomInstruction(randomInstructionPick?.action ?? null);
      setPendingRandomInstructionIndex(randomInstructionPick?.index ?? null);
      setPendingRandomInstructionRoundNumber(randomInstructionPick ? preSpinRoundNumber : null);
      setShowResultOverlay(false);
      setIsSpinning(true);
      runSequentialSpinTimeline();
    }
  };

  const onDrawAction = () => {
    if (game.session.isPaused) {
      return;
    }
    const preRoundNumber = game.session.currentRoundNumber;
    const preRound = game.rounds.find((round) => round.roundNumber === preRoundNumber) ?? game.rounds[0];
    const playerWhoDraws = game.session.activePlayer;
    const completedForRound = game.session.completedRandomInstructions?.[String(preRoundNumber)] ?? [];
    // Filter only by content + assigned player + completion. Cooldown does not apply here.
    const doneSet = new Set(completedForRound);
    const candidates = preRound.randomActions
      .map((action, originalIndex) => ({ action, index: originalIndex }))
      .filter(({ action, index }) => {
        if (doneSet.has(index)) {
          return false;
        }
        const text = action.text?.trim() ?? '';
        const hasContent = text.length > 0 || Boolean(action.imageRef) || Boolean(action.linkUrl);
        if (!hasContent) {
          return false;
        }
        const assigned = action.assignedPlayer ?? 'any';
        return assigned === 'any' || assigned === playerWhoDraws;
      });

    if (candidates.length === 0) {
      // No draw to show — just burn a turn so the round can still complete.
      advanceActionTurn(playerWhoDraws);
      return;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    pendingActionOnlyAdvanceRef.current = playerWhoDraws;
    clearRandomInstructionTimerIntervals();
    setIsRandomInstructionTimerRunning(false);
    setIsRandomInstructionTimerFlashing(false);
    setIsRandomInstructionTimerFlashOn(false);
    setRandomInstructionSecondsLeft(pick.action.timerSeconds ?? 0);
    setRandomInstructionImageFailed(false);
    setRandomInstructionStepImageFailed(false);
    setRandomInstructionStep(1);
    setActiveRandomInstruction(pick.action);
    setActiveRandomInstructionIndex(pick.index);
    setActiveRandomInstructionRoundNumber(preRoundNumber);
    setShowRandomInstructionOverlay(true);
    void playGameAudio('random');
  };

  const onRestart = () => {
    shownRoundIntrosRef.current = new Set();
    spinsSinceRandomInstructionRef.current = 999;
    pendingActionOnlyAdvanceRef.current = null;
    clearSpinTimelineTimeouts();
    clearReelStopTimeouts();
    setReelIsSpinning({ part: false, action: false, timer: false });
    setReelIsRevealed({ part: true, action: true, timer: true });
    setReelStopPulse({ part: false, action: false, timer: false });
    setSpinningPlayer(null);
    setRandomInstructionImageFailed(false);
    setShowRandomInstructionOverlay(false);
    clearRandomInstructionTimerIntervals();
    setIsRandomInstructionTimerRunning(false);
    setIsRandomInstructionTimerFlashing(false);
    setIsRandomInstructionTimerFlashOn(false);
    setRandomInstructionSecondsLeft(0);
    setShowRoundIntroOverlay(false);
    clearNopeTimerIntervals();
    setIsNopeTimerRunning(false);
    setIsNopeTimerFlashing(false);
    setIsNopeTimerFlashOn(false);
    setNopeSecondsLeft(0);
    setShowNopeTaskOverlay(false);
    setActiveNopeTask(null);
    setNopeTaskImageFailed(false);
    setActiveRoundIntro(null);
    setActiveRandomInstruction(null);
    setActiveRandomInstructionIndex(null);
    setActiveRandomInstructionRoundNumber(null);
    setRandomInstructionStep(1);
    setRandomInstructionStepImageFailed(false);
    setPendingRandomInstruction(null);
    setPendingRandomInstructionIndex(null);
    setPendingRandomInstructionRoundNumber(null);
    setShowGameOverOverlay(false);
    clearGameOverTimerIntervals();
    setIsGameOverTimerRunning(false);
    setIsGameOverTimerFlashing(false);
    setIsGameOverTimerFlashOn(false);
    setGameOverSecondsLeft(0);
    setGameOverTimerUnit('seconds');
    if (timerEndSoundRef.current) {
      timerEndSoundRef.current.pause();
      timerEndSoundRef.current.currentTime = 0;
    }
    if (roundIntroSoundRef.current) {
      roundIntroSoundRef.current.pause();
      roundIntroSoundRef.current.currentTime = 0;
    }
    if (randomActionSoundRef.current) {
      randomActionSoundRef.current.pause();
      randomActionSoundRef.current.currentTime = 0;
    }
    closeResultOverlay({ skipRandomInstruction: true, skipGameOver: true });
    setIsSpinning(false);
    restartGame();
  };

  return (
    <main className={PAGE_CONTAINER_CLASS}>
      <nav className="glass-panel mb-4 flex items-center justify-between rounded-xl p-3">
        <h1 className="heading-elegant text-3xl font-semibold">Sensual Slot Machine</h1>
        <div className="flex gap-3 text-sm font-medium">
          <Link className="underline" href="/">
            Gameplay
          </Link>
          <button className="underline" onClick={onRestart} type="button">
            Restart
          </button>
          <Link className="underline" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      {recoveryNotice ? <p className="mb-3 rounded bg-[#f5e6d3] p-2 text-sm text-[#5e2a4d]">{recoveryNotice}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="glass-card rounded-xl p-4 md:col-span-2 xl:min-h-[760px] 2xl:min-h-[860px]">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1">Current Round: {currentRound.name}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Turns: {roundCounter.P1 + roundCounter.P2}/{currentRound.totalTurns} (P1 {roundCounter.P1} · P2 {roundCounter.P2})
            </span>
            {game.session.isPaused ? (
              <button className="btn-luxe-outline ml-auto rounded px-4 py-2" onClick={resume} type="button">
                Resume
              </button>
            ) : (
              <button className="btn-luxe-outline ml-auto rounded px-4 py-2" onClick={pause} type="button">
                Pause
              </button>
            )}
          </div>

          {spinError ? <p className="mb-3 text-sm text-red-700">{spinError}</p> : null}

          <div className="mb-6 flex justify-center">
            <article className="glass-panel w-full max-w-sm rounded-2xl border border-[#d4af37]/70 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">Current Spinner</p>
              {currentSpinnerImage && !currentSpinnerImageFailed ? (
                <div
                  className={`relative mx-auto mt-2 overflow-hidden rounded-xl border border-[#d4af37]/45 bg-[#2f1530] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
                >
                  <Image
                    alt={`${currentSpinnerPlayer} current spinner image`}
                    className="object-contain"
                    fill
                    onError={() => {
                      if (currentSpinnerImage) {
                        setFailedImageMap((previous) => ({ ...previous, [currentSpinnerImage]: true }));
                      }
                    }}
                    sizes="128px"
                    src={currentSpinnerImage}
                  />
                </div>
              ) : (
                <div
                  className={`mx-auto mt-2 flex items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#2f1530] text-xs text-[#fadadd] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
                >
                  Add player image in Dashboard
                </div>
              )}
            </article>
          </div>

          {isActionsOnlyRound ? (
            <div className="flex flex-col items-center gap-5 py-6">
              <p className="text-center text-sm text-[#5e2a4d]">
                This round is action-only. Draw a task for {nextSpinnerPlayer}.
              </p>
              <button
                aria-label={`Draw action for ${nextSpinnerPlayer}`}
                className="btn-luxe rounded-2xl px-6 py-4 text-base font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  game.session.isPaused ||
                  showResultOverlay ||
                  showRandomInstructionOverlay ||
                  showRoundIntroOverlay ||
                  showNopeTaskOverlay
                }
                onClick={onDrawAction}
                type="button"
              >
                <span className="flex flex-col items-center gap-3">
                  {nextSpinnerImage && !nextSpinnerImageFailed ? (
                    <span className={`relative overflow-hidden rounded-xl border border-[#f5e6d3]/60 bg-[#2f1530] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}>
                      <Image
                        alt={`${nextSpinnerPlayer} next draw image`}
                        className="object-contain"
                        fill
                        onError={() => {
                          if (nextSpinnerImage) {
                            setFailedImageMap((previous) => ({ ...previous, [nextSpinnerImage]: true }));
                          }
                        }}
                        sizes="176px"
                        src={nextSpinnerImage}
                      />
                    </span>
                  ) : (
                    <span
                      className={`flex items-center justify-center rounded-xl border border-[#f5e6d3]/50 bg-[#2f1530] text-xs text-[#f5e6d3] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
                    >
                      Set player image
                    </span>
                  )}
                  <span>Draw Action</span>
                </span>
              </button>
            </div>
          ) : (
            <>
              <div className={`grid gap-3 ${isLastRound ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {!isLastRound && (
                  <SpinResultCard
                    item={game.session.lastSpinResult?.part ?? null}
                    key={`part-${game.session.lastSpinResult?.part?.imageRef ?? ''}-${game.session.lastSpinResult?.part?.text ?? ''}`}
                    pool={currentRound.spinners.part.map((entry) => entry.text)}
                    shouldPulseOnLand={reelStopPulse.part}
                    isRevealed={reelIsRevealed.part}
                    label="Body Part"
                    isSpinning={reelIsSpinning.part}
                  />
                )}
                <SpinResultCard
                  item={game.session.lastSpinResult?.action ?? null}
                  key={`action-${game.session.lastSpinResult?.action.imageRef ?? ''}-${game.session.lastSpinResult?.action.text ?? ''}`}
                  pool={currentRound.spinners.action.map((entry) => entry.text)}
                  shouldPulseOnLand={reelStopPulse.action}
                  isRevealed={reelIsRevealed.action}
                  label="Action"
                  isSpinning={reelIsSpinning.action}
                />
                <SpinResultCard
                  item={game.session.lastSpinResult?.timer ?? null}
                  key={`timer-${game.session.lastSpinResult?.timer.imageRef ?? ''}-${game.session.lastSpinResult?.timer.text ?? ''}`}
                  pool={currentRound.spinners.timer.map((entry) => entry.text)}
                  shouldPulseOnLand={reelStopPulse.timer}
                  isRevealed={reelIsRevealed.timer}
                  label="Timer"
                  isSpinning={reelIsSpinning.timer}
                />
              </div>

              <div className="mt-5 flex justify-center">
                <button
                  aria-label={`Spin turn for ${nextSpinnerPlayer}`}
                  className="btn-luxe rounded-2xl px-6 py-4 text-base font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    game.session.isPaused ||
                    isSpinning ||
                    showResultOverlay ||
                    showRandomInstructionOverlay ||
                    showRoundIntroOverlay ||
                    showNopeTaskOverlay ||
                    showGameOverOverlay
                  }
                  onClick={onSpin}
                  type="button"
                >
                  {isSpinning ? 'Spinning...' : 'Spin'}
                </button>
              </div>
            </>
          )}
        </article>

        <aside className="space-y-4">
          <article className="glass-card rounded-xl p-4 xl:min-h-[376px]">
            <h2 className="text-sm font-semibold">Side Video</h2>
            <div className="slot-window slot-window--idle mt-2 h-56 overflow-hidden rounded-lg border border-[#f5e6d3]/70 xl:h-80 2xl:h-[22rem]">
              {sideVideoEmbedUrl ? (
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={sideVideoEmbedUrl}
                  title="YouTube side video"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#fadadd]">No YouTube video set</div>
              )}
            </div>
            {game.sideVideoUrl ? (
              <a className="mt-2 inline-block text-xs underline" href={game.sideVideoUrl} rel="noreferrer noopener" target="_blank">
                If blocked, open video in YouTube
              </a>
            ) : null}
          </article>
          <article className="glass-card rounded-xl p-4 xl:min-h-[160px]">
            <h2 className="text-sm font-semibold">Rules</h2>
            <p className="mt-2 max-h-16 overflow-hidden text-sm whitespace-pre-wrap xl:max-h-24">{game.rulesText}</p>
            <button className="btn-luxe-outline mt-3 rounded px-3 py-1.5 text-xs font-semibold" onClick={() => setShowRulesOverlay(true)} type="button">
              More...
            </button>
          </article>
        </aside>
      </section>
      {showResultOverlay && game.session.lastSpinResult ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a1a30]/75 p-4"
          role="presentation"
        >
          <section
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-y-auto rounded-2xl border-2 border-[#d4af37] bg-gradient-to-b from-[#5e2a4d] to-[#3a1a30] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="heading-elegant text-center text-4xl font-bold tracking-wide text-[#f5e6d3]">Spin Result</h2>
            <p className="mt-1 text-center text-sm text-[#fadadd]/85">Review the result, then press Done to continue</p>
            <div className="mx-auto mt-5 flex w-full max-w-sm flex-col items-center rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/60 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">This is your task</p>
              {resultActionImage && !resultActionImageFailed ? (
                <div className={`relative mt-3 overflow-hidden rounded-xl border border-[#d4af37]/45 bg-[#2f1530] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}>
                  <Image
                    alt={`${resultActionPlayer} action spotlight`}
                    className="object-contain"
                    fill
                    onError={() => {
                      if (resultActionImage) {
                        setFailedImageMap((previous) => ({ ...previous, [resultActionImage]: true }));
                      }
                    }}
                    sizes="176px"
                    src={resultActionImage}
                  />
                </div>
              ) : (
                <div
                  className={`mt-3 flex items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#2f1530] text-xs text-[#fadadd] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
                >
                  Add player image in Dashboard
                </div>
              )}
              <p className="mt-3 text-sm font-semibold tracking-wide text-[#f5e6d3]">Remeber to have fun!</p>
            </div>
            <div className={`mt-6 grid gap-4 ${isLastRound ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              {!isLastRound && game.session.lastSpinResult.part ? (
                <OverlayResultCard item={game.session.lastSpinResult.part} label="Body Part" />
              ) : null}
              <OverlayResultCard item={game.session.lastSpinResult.action} label="Action" />
              <OverlayResultCard item={game.session.lastSpinResult.timer} label="Timer" />
            </div>
            <article
              className={`mt-6 rounded-xl border p-4 text-center transition-colors ${
                isTimerFlashing && isTimerFlashOn
                  ? 'border-[#f5e6d3] bg-[#f5e6d3] text-[#5e2a4d]'
                  : 'border-[#d4af37]/70 bg-[#5e2a4d]/65 text-[#f5e6d3]'
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
              <p className="mt-3 text-5xl font-black tabular-nums">{overlaySecondsLeft}s</p>
              <p className="mt-2 text-sm text-[#fadadd]/90">
                Source: {game.session.lastSpinResult.timer.text || `${DEFAULT_OVERLAY_TIMER_SECONDS} seconds default`}
              </p>
              <div className="mt-4">
                <button
                  className="btn-luxe rounded px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isOverlayTimerRunning || isTimerFlashing}
                  onClick={startOverlayTimer}
                  type="button"
                >
                  {isOverlayTimerRunning ? 'Running...' : 'Start Timer'}
                </button>
              </div>
            </article>
            <div className="mt-5 flex justify-center">
              <button className="btn-luxe rounded px-6 py-2 text-sm font-semibold" onClick={() => closeResultOverlay()} type="button">
                Done
              </button>
            </div>
            {currentRound.chickenOutText?.trim() ? (
              <div className="mt-4 rounded-xl border border-[#d4af37]/40 bg-[#3a1a30]/60 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#d4af37]">Chicken Out</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#fadadd]/85">{currentRound.chickenOutText}</p>
              </div>
            ) : null}
            {game.resultInfoText?.trim() ? (
              <p className="mt-3 whitespace-pre-wrap text-center text-xs italic text-[#fadadd]/70">
                {game.resultInfoText}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
      {showRulesOverlay ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#3a1a30]/75 p-4"
          onClick={() => setShowRulesOverlay(false)}
          role="presentation"
        >
          <section
            className="glass-panel w-full max-w-3xl rounded-2xl border border-[#d4af37]/60 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="heading-elegant text-3xl font-semibold text-[#f5e6d3]">Rules</h2>
              <button className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-semibold" onClick={() => setShowRulesOverlay(false)} type="button">
                Close
              </button>
            </div>
            <p className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-sm text-[#f5e6d3]">
              {game.rulesText}
            </p>
          </section>
        </div>
      ) : null}
      {showRandomInstructionOverlay && activeRandomInstruction ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#3a1a30]/82 p-4"
          role="presentation"
        >
          <section
            className="glass-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-[#d4af37]/70 p-6 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Random Instruction</p>
            <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">
              {activeRandomInstruction.assignedPlayer === 'P1' || activeRandomInstruction.assignedPlayer === 'P2'
                ? `${activeRandomInstruction.assignedPlayer}, Do This Now`
                : 'Do This Now'}
            </h2>
            {(() => {
              const assigned = activeRandomInstruction.assignedPlayer;
              const isForBoth = assigned === 'any';
              const targetPlayers: Player[] = isForBoth ? ['P1', 'P2'] : [assigned];
              const caption = isForBoth ? 'This is for you both!' : 'This is for you!';
              return (
                <div className="mx-auto mt-4 flex w-full max-w-xl flex-col items-center rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/60 p-4 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {targetPlayers.map((targetPlayer) => {
                      const targetPlayerImage = game.playerImages[targetPlayer];
                      const targetPlayerImageFailed = Boolean(
                        targetPlayerImage && failedImageMap[targetPlayerImage]
                      );
                      return targetPlayerImage && !targetPlayerImageFailed ? (
                        <div
                          className={`relative overflow-hidden rounded-xl border border-[#d4af37]/45 bg-[#2f1530] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
                          key={targetPlayer}
                        >
                          <Image
                            alt={`${targetPlayer} spotlight`}
                            className="object-contain"
                            fill
                            onError={() => {
                              if (targetPlayerImage) {
                                setFailedImageMap((previous) => ({ ...previous, [targetPlayerImage]: true }));
                              }
                            }}
                            sizes="176px"
                            src={targetPlayerImage}
                          />
                        </div>
                      ) : (
                        <div
                          className={`flex items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#2f1530] text-xs text-[#fadadd] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
                          key={targetPlayer}
                        >
                          Add {targetPlayer} image in Dashboard
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm font-semibold tracking-wide text-[#f5e6d3]">{caption}</p>
                </div>
              );
            })()}
            {(() => {
              const hasSecondStep = Boolean(activeRandomInstruction.secondStep);
              const onStep1 = hasSecondStep && randomInstructionStep === 1;
              const onStep2 = hasSecondStep && randomInstructionStep === 2;
              const viewText = onStep2
                ? activeRandomInstruction.secondStep?.text ?? ''
                : activeRandomInstruction.text;
              const viewImage = onStep2
                ? activeRandomInstruction.secondStep?.imageRef ?? null
                : activeRandomInstruction.imageRef;
              const viewImageFailed = onStep2
                ? randomInstructionStepImageFailed
                : randomInstructionImageFailed;
              const setViewImageFailed = onStep2
                ? setRandomInstructionStepImageFailed
                : setRandomInstructionImageFailed;
              const viewTimerSeconds = onStep2
                ? activeRandomInstruction.secondStep?.timerSeconds ?? null
                : activeRandomInstruction.timerSeconds;
              const viewTimerUnit = onStep2
                ? activeRandomInstruction.secondStep?.timerUnit ?? 'seconds'
                : activeRandomInstruction.timerUnit;

              return (
                <>
                  {hasSecondStep ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#fadadd]/80">
                      {onStep1 ? 'Step 1 of 2' : 'Step 2 of 2'}
                    </p>
                  ) : null}
                  {viewImage && !viewImageFailed ? (
                    <div className="relative mx-auto mt-5 h-60 w-full max-w-xl overflow-hidden rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55">
                      <Image
                        alt={onStep2 ? 'Random instruction step 2' : 'Random instruction'}
                        className="object-contain"
                        fill
                        onError={() => setViewImageFailed(true)}
                        sizes="(max-width: 768px) 100vw, 720px"
                        src={viewImage}
                      />
                    </div>
                  ) : null}
                  <p className="mt-5 whitespace-pre-wrap rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-lg font-semibold text-[#f5e6d3]">
                    {viewText || 'Follow the image instruction.'}
                  </p>
                  {viewTimerSeconds ? (
                    <article
                      className={`mt-5 rounded-xl border p-4 text-center transition-colors ${
                        isRandomInstructionTimerFlashing && isRandomInstructionTimerFlashOn
                          ? 'border-[#f5e6d3] bg-[#f5e6d3] text-[#5e2a4d]'
                          : 'border-[#d4af37]/70 bg-[#5e2a4d]/65 text-[#f5e6d3]'
                      }`}
                    >
                      <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
                      <p className="mt-3 text-5xl font-black tabular-nums">
                        {viewTimerUnit === 'minutes'
                          ? `${(randomInstructionSecondsLeft / 60).toFixed(randomInstructionSecondsLeft % 60 === 0 ? 0 : 2)}m`
                          : `${randomInstructionSecondsLeft}s`}
                      </p>
                      <p className="mt-2 text-sm text-[#fadadd]/90">
                        Source:{' '}
                        {viewTimerUnit === 'minutes'
                          ? `${+(viewTimerSeconds / 60).toFixed(2)} minute${viewTimerSeconds / 60 === 1 ? '' : 's'}`
                          : `${viewTimerSeconds} second${viewTimerSeconds === 1 ? '' : 's'}`}
                      </p>
                      <div className="mt-4">
                        <button
                          className="btn-luxe rounded px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isRandomInstructionTimerRunning || isRandomInstructionTimerFlashing}
                          onClick={startRandomInstructionTimer}
                          type="button"
                        >
                          {isRandomInstructionTimerRunning ? 'Running...' : 'Start Timer'}
                        </button>
                      </div>
                    </article>
                  ) : null}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    {onStep1 ? (
                      <button
                        className="btn-luxe rounded px-6 py-2 text-sm font-semibold"
                        onClick={onNextRandomInstructionStep}
                        type="button"
                      >
                        Next
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-luxe rounded px-6 py-2 text-sm font-semibold"
                          onClick={dismissRandomInstruction}
                          type="button"
                        >
                          Got It
                        </button>
                        {activeRandomInstruction.nopeAlternative ? (
                          <button
                            className="btn-luxe-outline rounded px-6 py-2 text-sm font-semibold"
                            onClick={onNopeRandomInstruction}
                            type="button"
                          >
                            Nope
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                  {!onStep1 && activeRandomInstruction.linkUrl ? (
                    <button
                      className="btn-luxe-outline mt-3 rounded px-6 py-2 text-sm font-semibold"
                      onClick={() => {
                        window.open(activeRandomInstruction.linkUrl ?? '', '_blank', 'noopener,noreferrer');
                        dismissRandomInstruction();
                      }}
                      type="button"
                    >
                      Open Link
                    </button>
                  ) : null}
                </>
              );
            })()}
          </section>
        </div>
      ) : null}
      {showNopeTaskOverlay && activeNopeTask ? (
        <div
          className="fixed inset-0 z-[68] flex items-center justify-center bg-[#3a1a30]/82 p-4"
          role="presentation"
        >
          <section
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border-2 border-[#d4af37] bg-gradient-to-b from-[#5e2a4d] to-[#3a1a30] p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Opted Out</p>
            <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">New Task</h2>
            {activeNopeTask.imageRef && !nopeTaskImageFailed ? (
              <div className="relative mx-auto mt-5 h-60 w-full max-w-xl overflow-hidden rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55">
                <Image
                  alt="Nope replacement task"
                  className="object-contain"
                  fill
                  onError={() => setNopeTaskImageFailed(true)}
                  sizes="(max-width: 768px) 100vw, 720px"
                  src={activeNopeTask.imageRef}
                />
              </div>
            ) : null}
            <p className="mt-5 whitespace-pre-wrap rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-lg font-semibold text-[#f5e6d3]">
              {activeNopeTask.text || 'Follow the image instruction.'}
            </p>
            {activeNopeTask.timerSeconds ? (
              <article
                className={`mt-5 rounded-xl border p-4 text-center transition-colors ${
                  isNopeTimerFlashing && isNopeTimerFlashOn
                    ? 'border-[#f5e6d3] bg-[#f5e6d3] text-[#5e2a4d]'
                    : 'border-[#d4af37]/70 bg-[#5e2a4d]/65 text-[#f5e6d3]'
                }`}
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
                <p className="mt-3 text-5xl font-black tabular-nums">
                  {activeNopeTask.timerUnit === 'minutes'
                    ? `${(nopeSecondsLeft / 60).toFixed(nopeSecondsLeft % 60 === 0 ? 0 : 2)}m`
                    : `${nopeSecondsLeft}s`}
                </p>
                <p className="mt-2 text-sm text-[#fadadd]/90">
                  Source:{' '}
                  {activeNopeTask.timerUnit === 'minutes'
                    ? `${+(activeNopeTask.timerSeconds / 60).toFixed(2)} minute${activeNopeTask.timerSeconds / 60 === 1 ? '' : 's'}`
                    : `${activeNopeTask.timerSeconds} second${activeNopeTask.timerSeconds === 1 ? '' : 's'}`}
                </p>
                <div className="mt-4">
                  <button
                    className="btn-luxe rounded px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isNopeTimerRunning || isNopeTimerFlashing}
                    onClick={startNopeTimer}
                    type="button"
                  >
                    {isNopeTimerRunning ? 'Running...' : 'Start Timer'}
                  </button>
                </div>
              </article>
            ) : null}
            <div className="mt-5 flex justify-center">
              <button
                className="btn-luxe rounded px-6 py-2 text-sm font-semibold"
                onClick={closeNopeTaskOverlay}
                type="button"
              >
                Got It
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {showGameOverOverlay ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1a0a1a]/92 p-4"
          role="presentation"
        >
          <section
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border-2 border-[#d4af37] bg-gradient-to-b from-[#5e2a4d] to-[#3a1a30] p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Final Round Complete</p>
            <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">Game Over...or is it?</h2>
            <p className="mt-2 text-sm text-[#fadadd]/80">The night isn&apos;t over just yet — one last challenge awaits.</p>
            <div className="mt-6 rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#d4af37]">Your Final Act</p>
              <p className="mt-4 whitespace-pre-wrap text-xl font-bold text-[#f5e6d3]">{gameOverAction}</p>
            </div>
            <article
              className={`mt-5 rounded-xl border p-4 text-center transition-colors ${
                isGameOverTimerFlashing && isGameOverTimerFlashOn
                  ? 'border-[#f5e6d3] bg-[#f5e6d3] text-[#5e2a4d]'
                  : 'border-[#d4af37]/70 bg-[#5e2a4d]/65 text-[#f5e6d3]'
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
              <p className="mt-3 text-5xl font-black tabular-nums">
                {gameOverTimerUnit === 'minutes'
                  ? `${(gameOverSecondsLeft / 60).toFixed(gameOverSecondsLeft % 60 === 0 ? 0 : 2)}m`
                  : `${gameOverSecondsLeft}s`}
              </p>
              <div className="mt-4">
                <button
                  className="btn-luxe rounded px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isGameOverTimerRunning || isGameOverTimerFlashing}
                  onClick={startGameOverTimer}
                  type="button"
                >
                  {isGameOverTimerRunning ? 'Running...' : 'Start Timer'}
                </button>
              </div>
            </article>
            <div className="mt-6 flex justify-center">
              <button
                className="btn-luxe rounded px-8 py-2.5 text-sm font-semibold"
                onClick={closeGameOverOverlay}
                type="button"
              >
                The End
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {showRoundIntroOverlay && activeRoundIntro ? (
        <div
          className="fixed inset-0 z-[72] flex items-center justify-center bg-[#3a1a30]/82 p-4"
          role="presentation"
        >
          <section
            className="glass-panel w-full max-w-2xl rounded-2xl border border-[#d4af37]/70 p-6 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Round Transition</p>
            <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">Welcome to {activeRoundIntro.name}</h2>
            {activeRoundIntroImageRef && !failedImageMap[activeRoundIntroImageRef] ? (
              <div className="relative mx-auto mt-5 h-60 w-full max-w-xl overflow-hidden rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55">
                <Image
                  alt={`${activeRoundIntro.name} intro`}
                  className="object-contain"
                  fill
                  onError={() => {
                    if (activeRoundIntroImageRef) {
                      setFailedImageMap((previous) => ({ ...previous, [activeRoundIntroImageRef]: true }));
                    }
                  }}
                  sizes="(max-width: 768px) 100vw, 720px"
                  src={activeRoundIntroImageRef}
                />
              </div>
            ) : null}
            <p className="mt-5 rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-lg font-semibold text-[#f5e6d3]">
              {activeRoundIntro.introText}
            </p>
            <button
              className="btn-luxe mt-5 rounded px-6 py-2 text-sm font-semibold"
              onClick={() => {
                setShowRoundIntroOverlay(false);
                setActiveRoundIntro(null);
              }}
              type="button"
            >
              Let&apos;s Play
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
