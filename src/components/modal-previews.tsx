'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { NopeAlternative, Player, RandomAction, Round, SpinResultItem } from '@/src/lib/game/types';

const PLAYER_IMAGE_FRAME_SIZE_CLASS = 'h-44 w-32 xl:h-56 xl:w-40 2xl:h-64 2xl:w-44';
const DEFAULT_OVERLAY_TIMER_SECONDS = 10;

function PreviewFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview: {label}</p>
      <div className="overflow-auto rounded-xl bg-[#3a1a30]/80 p-4">{children}</div>
    </div>
  );
}

function OverlayResultCardPreview({
  label,
  item
}: {
  label: 'Body Part' | 'Action' | 'Timer';
  item: SpinResultItem;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.imageRef) && !imageFailed;

  return (
    <article className="rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/70 p-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">{label}</p>
      {hasImage ? (
        <div className="relative mt-4 h-44 overflow-hidden rounded border border-[#d4af37]/50 bg-[#3a1a30]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`${label} overlay result`}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setImageFailed(true)}
            src={item.imageRef ?? ''}
          />
        </div>
      ) : null}
      <p className="mt-4 text-3xl font-bold text-[#f5e6d3]">{item.text || label}</p>
    </article>
  );
}

function PlayerFrame({
  player,
  imageRef,
  label
}: {
  player: Player;
  imageRef: string | null;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  return imageRef && !failed ? (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#d4af37]/45 bg-[#2f1530] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
    >
      <Image
        alt={`${player} ${label}`}
        className="object-contain"
        fill
        onError={() => setFailed(true)}
        sizes="176px"
        src={imageRef}
      />
    </div>
  ) : (
    <div
      className={`flex items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#2f1530] text-xs text-[#fadadd] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
    >
      Add {player} image in Dashboard
    </div>
  );
}

function OverlayImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return null;
  }
  return (
    <div className="relative mx-auto mt-5 h-60 w-full max-w-xl overflow-hidden rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55">
      <Image
        alt={alt}
        className="object-contain"
        fill
        onError={() => setFailed(true)}
        sizes="(max-width: 768px) 100vw, 720px"
        src={src}
      />
    </div>
  );
}

export function SpinResultModalPreview({
  resultInfoText,
  isLastRound,
  partItem,
  actionItem,
  timerItem,
  taskPlayer,
  taskPlayerImage,
  initialSecondsLeft
}: {
  resultInfoText: string;
  isLastRound: boolean;
  partItem: SpinResultItem | null;
  actionItem: SpinResultItem;
  timerItem: SpinResultItem;
  taskPlayer: Player;
  taskPlayerImage: string | null;
  initialSecondsLeft: number;
}) {
  return (
    <PreviewFrame label="Spin Result">
      <section className="w-full max-w-6xl rounded-2xl border-2 border-[#d4af37] bg-gradient-to-b from-[#5e2a4d] to-[#3a1a30] p-6 shadow-2xl">
        <h2 className="heading-elegant text-center text-4xl font-bold tracking-wide text-[#f5e6d3]">Spin Result</h2>
        <p className="mt-1 text-center text-sm text-[#fadadd]/85">Review the result, then press Done to continue</p>
        <div className="mx-auto mt-5 flex w-full max-w-sm flex-col items-center rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/60 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">This is your task</p>
          <div className="mt-3">
            <PlayerFrame player={taskPlayer} imageRef={taskPlayerImage} label="action spotlight" />
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-[#f5e6d3]">Remeber to have fun!</p>
        </div>
        <div className={`mt-6 grid gap-4 ${isLastRound ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {!isLastRound && partItem ? <OverlayResultCardPreview item={partItem} label="Body Part" /> : null}
          <OverlayResultCardPreview item={actionItem} label="Action" />
          <OverlayResultCardPreview item={timerItem} label="Timer" />
        </div>
        <article className="mt-6 rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/65 p-4 text-center text-[#f5e6d3]">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
          <p className="mt-3 text-5xl font-black tabular-nums">{initialSecondsLeft}s</p>
          <p className="mt-2 text-sm text-[#fadadd]/90">
            Source: {timerItem.text || `${DEFAULT_OVERLAY_TIMER_SECONDS} seconds default`}
          </p>
          <div className="mt-4">
            <button
              className="btn-luxe rounded px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              disabled
              type="button"
            >
              Start Timer
            </button>
          </div>
        </article>
        <div className="mt-5 flex justify-center">
          <button className="btn-luxe rounded px-6 py-2 text-sm font-semibold" disabled type="button">
            Done
          </button>
        </div>
        {resultInfoText?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-center text-xs italic text-[#fadadd]/70">{resultInfoText}</p>
        ) : null}
      </section>
    </PreviewFrame>
  );
}

export function RulesModalPreview({ rulesText }: { rulesText: string }) {
  return (
    <PreviewFrame label="Rules">
      <section className="glass-panel w-full max-w-3xl rounded-2xl border border-[#d4af37]/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="heading-elegant text-3xl font-semibold text-[#f5e6d3]">Rules</h2>
          <button className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-semibold" disabled type="button">
            Close
          </button>
        </div>
        <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-sm text-[#f5e6d3]">
          {rulesText || 'No rules text configured yet.'}
        </p>
      </section>
    </PreviewFrame>
  );
}

export function RandomInstructionModalPreview({
  action,
  playerImages,
  fallbackActivePlayer,
  step = 1
}: {
  action: RandomAction;
  playerImages: Record<Player, string | null>;
  fallbackActivePlayer: Player;
  step?: 1 | 2;
}) {
  const assigned = action.assignedPlayer;
  const isForBoth = assigned === 'any';
  const targetPlayers: Player[] = isForBoth ? ['P1', 'P2'] : [assigned];
  const caption = isForBoth ? 'This is for you both!' : 'This is for you!';
  const headlineLabel =
    assigned === 'P1' || assigned === 'P2' ? `${assigned}, Do This Now` : 'Do This Now';
  // fallbackActivePlayer is accepted for future use when 'any' needs to resolve to a single player.
  void fallbackActivePlayer;

  const hasSecondStep = Boolean(action.secondStep);
  const onStep1 = hasSecondStep && step === 1;
  const onStep2 = hasSecondStep && step === 2;

  const viewText = onStep2 ? action.secondStep?.text ?? '' : action.text;
  const viewImage = onStep2 ? action.secondStep?.imageRef ?? null : action.imageRef;
  const viewTimerSeconds = onStep2 ? action.secondStep?.timerSeconds ?? null : action.timerSeconds;
  const viewTimerUnit = onStep2 ? action.secondStep?.timerUnit ?? 'seconds' : action.timerUnit;

  const formatSource = () => {
    if (!viewTimerSeconds) {
      return null;
    }
    return viewTimerUnit === 'minutes'
      ? `${+(viewTimerSeconds / 60).toFixed(2)} minute${viewTimerSeconds / 60 === 1 ? '' : 's'}`
      : `${viewTimerSeconds} second${viewTimerSeconds === 1 ? '' : 's'}`;
  };

  const formatCountdown = () => {
    if (!viewTimerSeconds) {
      return '';
    }
    return viewTimerUnit === 'minutes'
      ? `${(viewTimerSeconds / 60).toFixed(viewTimerSeconds % 60 === 0 ? 0 : 2)}m`
      : `${viewTimerSeconds}s`;
  };

  return (
    <PreviewFrame label={`Random Instruction${hasSecondStep ? ` — Step ${step} of 2` : ''}`}>
      <section className="glass-panel w-full max-w-2xl rounded-2xl border border-[#d4af37]/70 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Random Instruction</p>
        <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">{headlineLabel}</h2>
        <div className="mx-auto mt-4 flex w-full max-w-xl flex-col items-center rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/60 p-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {targetPlayers.map((targetPlayer) => (
              <PlayerFrame
                key={targetPlayer}
                player={targetPlayer}
                imageRef={playerImages[targetPlayer]}
                label="spotlight"
              />
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-[#f5e6d3]">{caption}</p>
        </div>
        {hasSecondStep ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#fadadd]/80">
            {onStep1 ? 'Step 1 of 2' : 'Step 2 of 2'}
          </p>
        ) : null}
        {viewImage ? (
          <OverlayImage
            src={viewImage}
            alt={onStep2 ? 'Random instruction step 2' : 'Random instruction'}
          />
        ) : null}
        <p className="mt-5 whitespace-pre-wrap rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-lg font-semibold text-[#f5e6d3]">
          {viewText || 'Follow the image instruction.'}
        </p>
        {viewTimerSeconds ? (
          <article className="mt-5 rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/65 p-4 text-center text-[#f5e6d3]">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
            <p className="mt-3 text-5xl font-black tabular-nums">{formatCountdown()}</p>
            <p className="mt-2 text-sm text-[#fadadd]/90">Source: {formatSource()}</p>
            <div className="mt-4">
              <button className="btn-luxe rounded px-5 py-2 text-sm font-semibold" disabled type="button">
                Start Timer
              </button>
            </div>
          </article>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {onStep1 ? (
            <button className="btn-luxe rounded px-6 py-2 text-sm font-semibold" disabled type="button">
              Next
            </button>
          ) : (
            <>
              <button className="btn-luxe rounded px-6 py-2 text-sm font-semibold" disabled type="button">
                Got It
              </button>
              {action.nopeAlternative ? (
                <button
                  className="btn-luxe-outline rounded px-6 py-2 text-sm font-semibold"
                  disabled
                  type="button"
                >
                  Nope
                </button>
              ) : null}
            </>
          )}
        </div>
        {!onStep1 && action.linkUrl ? (
          <button className="btn-luxe-outline mt-3 rounded px-6 py-2 text-sm font-semibold" disabled type="button">
            Open Link
          </button>
        ) : null}
      </section>
    </PreviewFrame>
  );
}

export function NopeTaskModalPreview({ nope }: { nope: NopeAlternative }) {
  const formatSource = () => {
    if (!nope.timerSeconds) {
      return null;
    }
    return nope.timerUnit === 'minutes'
      ? `${+(nope.timerSeconds / 60).toFixed(2)} minute${nope.timerSeconds / 60 === 1 ? '' : 's'}`
      : `${nope.timerSeconds} second${nope.timerSeconds === 1 ? '' : 's'}`;
  };

  const formatCountdown = () => {
    if (!nope.timerSeconds) {
      return '';
    }
    return nope.timerUnit === 'minutes'
      ? `${(nope.timerSeconds / 60).toFixed(nope.timerSeconds % 60 === 0 ? 0 : 2)}m`
      : `${nope.timerSeconds}s`;
  };

  return (
    <PreviewFrame label="Nope Task">
      <section className="w-full max-w-2xl rounded-2xl border-2 border-[#d4af37] bg-gradient-to-b from-[#5e2a4d] to-[#3a1a30] p-6 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Opted Out</p>
        <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">New Task</h2>
        {nope.imageRef ? <OverlayImage src={nope.imageRef} alt="Nope replacement task" /> : null}
        <p className="mt-5 whitespace-pre-wrap rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-lg font-semibold text-[#f5e6d3]">
          {nope.text || 'Follow the image instruction.'}
        </p>
        {nope.timerSeconds ? (
          <article className="mt-5 rounded-xl border border-[#d4af37]/70 bg-[#5e2a4d]/65 p-4 text-center text-[#f5e6d3]">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#d4af37]">Countdown</p>
            <p className="mt-3 text-5xl font-black tabular-nums">{formatCountdown()}</p>
            <p className="mt-2 text-sm text-[#fadadd]/90">Source: {formatSource()}</p>
            <div className="mt-4">
              <button className="btn-luxe rounded px-5 py-2 text-sm font-semibold" disabled type="button">
                Start Timer
              </button>
            </div>
          </article>
        ) : null}
        <div className="mt-5 flex justify-center">
          <button className="btn-luxe rounded px-6 py-2 text-sm font-semibold" disabled type="button">
            Got It
          </button>
        </div>
      </section>
    </PreviewFrame>
  );
}

export function RoundIntroModalPreview({ round }: { round: Round }) {
  return (
    <PreviewFrame label="Round Intro">
      <section className="glass-panel w-full max-w-2xl rounded-2xl border border-[#d4af37]/70 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">Round Transition</p>
        <h2 className="heading-elegant mt-2 text-4xl font-bold text-[#f5e6d3]">Welcome to {round.name}</h2>
        {round.introImageRef ? <OverlayImage src={round.introImageRef} alt={`${round.name} intro`} /> : null}
        <p className="mt-5 rounded-xl border border-[#f5e6d3]/35 bg-[#5e2a4d]/55 p-4 text-lg font-semibold text-[#f5e6d3]">
          {round.introText}
        </p>
        <button className="btn-luxe mt-5 rounded px-6 py-2 text-sm font-semibold" disabled type="button">
          Let&apos;s Play
        </button>
      </section>
    </PreviewFrame>
  );
}
