'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { NopeAlternative, Player, RandomAction, Round, SpinResultItem } from '@/src/lib/game/types';

const PLAYER_IMAGE_FRAME_SIZE_CLASS = 'h-28 w-20 xl:h-32 xl:w-24';
const DEFAULT_OVERLAY_TIMER_SECONDS = 10;

function PreviewFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview: {label}</p>
      <div className="modal-scrim overflow-auto rounded-lg p-4">{children}</div>
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
    <article className="modal-content-card rounded-lg p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#f0ca61]">{label}</p>
      {hasImage ? (
        <div className="relative mt-3 h-28 overflow-hidden rounded-lg border border-[#f5e6d3]/14 bg-[#120b17]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`${label} overlay result`}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setImageFailed(true)}
            src={item.imageRef ?? ''}
          />
        </div>
      ) : null}
      <p className="mt-3 text-xl font-bold text-[#fff7ef]">{item.text || label}</p>
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
      className={`relative overflow-hidden rounded-lg border border-[#f5e6d3]/16 bg-[#120b17] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
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
      className={`flex items-center justify-center rounded-lg border border-[#f5e6d3]/16 bg-[#120b17] px-4 text-xs text-[#d9c4c8] ${PLAYER_IMAGE_FRAME_SIZE_CLASS}`}
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
    <div className="modal-content-card relative mx-auto mt-3 h-40 w-full max-w-md overflow-hidden rounded-lg">
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
      <section className="modal-shell w-full max-w-5xl rounded-lg p-4">
        <div className="text-center">
          <span className="modal-badge">Spin Result</span>
          <h2 className="heading-elegant mt-2 text-2xl font-bold tracking-wide text-[#fff7ef] md:text-3xl">Spin Result</h2>
          <p className="mt-1 text-xs text-[#d9c4c8]">Review the result, then press Done to continue</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="modal-content-card mx-auto flex w-full max-w-xs flex-col items-center rounded-lg p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#f0ca61]">This is your task</p>
              <div className="mt-2">
                <PlayerFrame player={taskPlayer} imageRef={taskPlayerImage} label="action spotlight" />
              </div>
              <p className="mt-2 text-xs font-semibold tracking-wide text-[#fff7ef]">Remember to have fun!</p>
            </div>
            <div className={`mt-4 grid gap-3 ${isLastRound ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              {!isLastRound && partItem ? <OverlayResultCardPreview item={partItem} label="Body Part" /> : null}
              <OverlayResultCardPreview item={actionItem} label="Action" />
              <OverlayResultCardPreview item={timerItem} label="Timer" />
            </div>
          </div>
          <article className="timer-panel mt-4 rounded-lg p-3 text-center text-[#fff7ef]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#f0ca61]">Countdown</p>
            <p className="mt-2 text-4xl font-black tabular-nums">{initialSecondsLeft}s</p>
            <p className="mt-2 text-xs text-[#d9c4c8]">
              Source: {timerItem.text || `${DEFAULT_OVERLAY_TIMER_SECONDS} seconds default`}
            </p>
            <div className="mt-3">
              <button
                className="btn-luxe modal-action-button modal-action-button--sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled
                type="button"
              >
                Start Timer
              </button>
            </div>
          </article>
        </div>
        <div className="mt-4 flex justify-center">
          <button className="btn-luxe modal-action-button" disabled type="button">
            Done
          </button>
        </div>
        {resultInfoText?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-center text-xs italic text-[#d9c4c8]/80">{resultInfoText}</p>
        ) : null}
      </section>
    </PreviewFrame>
  );
}

export function RulesModalPreview({ rulesText }: { rulesText: string }) {
  return (
    <PreviewFrame label="Rules">
      <section className="modal-shell w-full max-w-3xl rounded-lg p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <span className="modal-badge">Rules</span>
            <h2 className="heading-elegant mt-2 text-3xl font-bold text-[#fff7ef]">Rules</h2>
          </div>
          <button className="modal-action-button modal-action-button--sm modal-action-button--secondary" disabled type="button">
            Close
          </button>
        </div>
        <p className="modal-content-card max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg p-4 text-sm text-[#fff7ef]">
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
      <section className="modal-shell w-full max-w-xl rounded-lg p-4 text-center">
        <span className="modal-badge mx-auto">Random Instruction</span>
        <h2 className="heading-elegant mt-2 text-2xl font-bold text-[#fff7ef] md:text-3xl">{headlineLabel}</h2>
        <div className="modal-content-card mx-auto mt-3 flex w-full max-w-md flex-col items-center rounded-lg p-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {targetPlayers.map((targetPlayer) => (
              <PlayerFrame
                key={targetPlayer}
                player={targetPlayer}
                imageRef={playerImages[targetPlayer]}
                label="spotlight"
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold tracking-wide text-[#fff7ef]">{caption}</p>
        </div>
        {hasSecondStep ? (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#d9c4c8]">
            {onStep1 ? 'Step 1 of 2' : 'Step 2 of 2'}
          </p>
        ) : null}
        {viewImage ? (
          <OverlayImage
            src={viewImage}
            alt={onStep2 ? 'Random instruction step 2' : 'Random instruction'}
          />
        ) : null}
        <p className="modal-content-card mt-3 whitespace-pre-wrap rounded-lg p-3 text-base font-semibold text-[#fff7ef]">
          {viewText || 'Follow the image instruction.'}
        </p>
        {viewTimerSeconds ? (
          <article className="timer-panel mt-4 rounded-lg p-3 text-center text-[#fff7ef]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#f0ca61]">Countdown</p>
            <p className="mt-2 text-4xl font-black tabular-nums">{formatCountdown()}</p>
            <p className="mt-2 text-xs text-[#d9c4c8]">Source: {formatSource()}</p>
            <div className="mt-3">
              <button className="btn-luxe modal-action-button modal-action-button--sm" disabled type="button">
                Start Timer
              </button>
            </div>
          </article>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {onStep1 ? (
            <button className="btn-luxe modal-action-button" disabled type="button">
              Next
            </button>
          ) : (
            <>
              <button className="btn-luxe modal-action-button" disabled type="button">
                Got It
              </button>
              {action.nopeAlternative ? (
                <button
                  className="modal-action-button modal-action-button--secondary"
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
          <button className="modal-action-button modal-action-button--secondary mt-3" disabled type="button">
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
      <section className="modal-shell w-full max-w-xl rounded-lg p-4 text-center">
        <span className="modal-badge mx-auto">Opted Out</span>
        <h2 className="heading-elegant mt-2 text-2xl font-bold text-[#fff7ef] md:text-3xl">New Task</h2>
        {nope.imageRef ? <OverlayImage src={nope.imageRef} alt="Nope replacement task" /> : null}
        <p className="modal-content-card mt-3 whitespace-pre-wrap rounded-lg p-3 text-base font-semibold text-[#fff7ef]">
          {nope.text || 'Follow the image instruction.'}
        </p>
        {nope.timerSeconds ? (
          <article className="timer-panel mt-4 rounded-lg p-3 text-center text-[#fff7ef]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#f0ca61]">Countdown</p>
            <p className="mt-2 text-4xl font-black tabular-nums">{formatCountdown()}</p>
            <p className="mt-2 text-xs text-[#d9c4c8]">Source: {formatSource()}</p>
            <div className="mt-3">
              <button className="btn-luxe modal-action-button modal-action-button--sm" disabled type="button">
                Start Timer
              </button>
            </div>
          </article>
        ) : null}
        <div className="mt-4 flex justify-center">
          <button className="btn-luxe modal-action-button" disabled type="button">
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
      <section className="modal-shell w-full max-w-2xl rounded-lg p-6 text-center">
        <span className="modal-badge mx-auto">Round Transition</span>
        <h2 className="heading-elegant mt-3 text-3xl font-bold text-[#fff7ef] md:text-4xl">Welcome to {round.name}</h2>
        {round.introImageRef ? <OverlayImage src={round.introImageRef} alt={`${round.name} intro`} /> : null}
        <p className="modal-content-card mt-5 rounded-lg p-4 text-lg font-semibold text-[#fff7ef]">
          {round.introText}
        </p>
        <button className="btn-luxe modal-action-button mt-5" disabled type="button">
          Let&apos;s Play
        </button>
      </section>
    </PreviewFrame>
  );
}
