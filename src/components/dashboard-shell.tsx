'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useGameStore } from '@/src/lib/game/store';
import { MAX_ROUNDS, Player, RandomAction, Round, SpinnerType } from '@/src/lib/game/types';
import { isValidAudioUrl, isValidSpinnerImageUrl, isValidYouTubeUrl } from '@/src/lib/game/config';
import { clearLocalVideo, loadLocalVideo, saveLocalVideo } from '@/src/lib/game/local-video-store';
import { PAGE_CONTAINER_CLASS } from '@/src/lib/ui/layout';
import {
  NopeTaskModalPreview,
  RandomInstructionModalPreview,
  RoundIntroModalPreview,
  RulesModalPreview,
  SpinResultModalPreview
} from '@/src/components/modal-previews';

type DashboardTab = 'rounds' | 'spinners' | 'rules' | 'previews';

function normalizeTab(value: string | null): DashboardTab {
  if (value === 'rounds' || value === 'spinners' || value === 'rules' || value === 'previews') {
    return value;
  }

  return 'rounds';
}

interface SignUploadResponse {
  uploadUrl: string;
  publicUrl: string;
}

async function uploadMediaFile(file: File): Promise<string> {
  const signResponse = await fetch('/api/images/sign-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    })
  });

  if (!signResponse.ok) {
    throw new Error('Unable to prepare file upload. You can still save this entry without media.');
  }

  const signed = (await signResponse.json()) as SignUploadResponse;
  const uploadResponse = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type
    },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error('File upload failed. You can still continue without this media file.');
  }

  return signed.publicUrl;
}

function ImagePreview({ imageRef }: { imageRef: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-500">Preview</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Spinner upload preview"
        className="mt-1 h-24 w-full max-w-xs rounded border object-cover"
        src={imageRef}
      />
    </div>
  );
}

function SpinnerEntryEditor({
  roundNumber,
  spinnerType,
  entryId,
  initialText,
  initialImageRef
}: {
  roundNumber: number;
  spinnerType: SpinnerType;
  entryId: string;
  initialText: string;
  initialImageRef: string | null;
}) {
  const updateSpinnerEntry = useGameStore((state) => state.updateSpinnerEntry);
  const deleteSpinnerEntry = useGameStore((state) => state.deleteSpinnerEntry);
  const [text, setText] = useState(initialText);
  const [imageRef, setImageRef] = useState(initialImageRef ?? '');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <li className="rounded border p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <label className="text-sm">
          Text
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setText(event.target.value)}
            type="text"
            value={text}
          />
        </label>
        <label className="text-sm">
          Image URL (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setImageRef(event.target.value)}
            placeholder="https://example.com/image.webp"
            type="url"
            value={imageRef}
          />
        </label>
        <button
          className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
          onClick={() => updateSpinnerEntry(roundNumber, spinnerType, entryId, text, imageRef || null)}
          type="button"
        >
          Save
        </button>
        <button
          className="btn-luxe-outline rounded px-3 py-2 text-sm"
          onClick={() => deleteSpinnerEntry(roundNumber, spinnerType, entryId)}
          type="button"
        >
          Delete
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={uploadBusy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }

            setUploadBusy(true);
            setUploadError(null);
            try {
              const publicUrl = await uploadMediaFile(file);
              setImageRef(publicUrl);
              updateSpinnerEntry(roundNumber, spinnerType, entryId, text, publicUrl);
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : 'Upload failed.');
            } finally {
              setUploadBusy(false);
              event.currentTarget.value = '';
            }
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploadBusy ? 'Uploading...' : 'Upload Image'}
        </button>
        <span className="text-slate-500">Upload an image file (optional)</span>
      </div>
      {imageRef && isValidSpinnerImageUrl(imageRef) ? <ImagePreview imageRef={imageRef} /> : null}
      {imageRef && !isValidSpinnerImageUrl(imageRef) ? (
        <p className="mt-2 text-xs text-amber-700">Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.</p>
      ) : null}
      {uploadError ? <p className="mt-2 text-xs text-amber-700">{uploadError}</p> : null}
    </li>
  );
}

function formatTimerDraft(rawValue: number | null | undefined, _unit: 'seconds' | 'minutes'): string {
  if (rawValue == null) {
    return '';
  }
  return String(rawValue);
}

function RandomActionEditor({ roundNumber, index, action }: { roundNumber: number; index: number; action: RandomAction }) {
  const updateRoundRandomAction = useGameStore((state) => state.updateRoundRandomAction);
  const initialNopeTimerUnit: 'seconds' | 'minutes' = action.nopeAlternative?.timerUnit ?? 'seconds';
  const initialNopeTimerDraft = formatTimerDraft(action.nopeAlternative?.timerSeconds ?? null, initialNopeTimerUnit);
  const initialActionTimerUnit: 'seconds' | 'minutes' = action.timerUnit ?? 'seconds';
  const initialActionTimerDraft = formatTimerDraft(action.timerSeconds ?? null, initialActionTimerUnit);

  const [text, setText] = useState(action.text);
  const [imageRef, setImageRef] = useState(action.imageRef ?? '');
  const [linkUrl, setLinkUrl] = useState(action.linkUrl ?? '');
  const [assignedPlayer, setAssignedPlayer] = useState<'any' | 'P1' | 'P2'>(action.assignedPlayer ?? 'any');
  const [actionTimerUnit, setActionTimerUnit] = useState<'seconds' | 'minutes'>(initialActionTimerUnit);
  const [actionTimerDraft, setActionTimerDraft] = useState<string>(initialActionTimerDraft);
  const [nopeText, setNopeText] = useState(action.nopeAlternative?.text ?? '');
  const [nopeImageRef, setNopeImageRef] = useState(action.nopeAlternative?.imageRef ?? '');
  const [nopeTimerUnit, setNopeTimerUnit] = useState<'seconds' | 'minutes'>(initialNopeTimerUnit);
  const [nopeTimerDraft, setNopeTimerDraft] = useState<string>(initialNopeTimerDraft);
  const initialStep2TimerUnit: 'seconds' | 'minutes' = action.secondStep?.timerUnit ?? 'seconds';
  const initialStep2TimerDraft = formatTimerDraft(action.secondStep?.timerSeconds ?? null, initialStep2TimerUnit);
  const [step2Text, setStep2Text] = useState(action.secondStep?.text ?? '');
  const [step2ImageRef, setStep2ImageRef] = useState(action.secondStep?.imageRef ?? '');
  const [step2TimerUnit, setStep2TimerUnit] = useState<'seconds' | 'minutes'>(initialStep2TimerUnit);
  const [step2TimerDraft, setStep2TimerDraft] = useState<string>(initialStep2TimerDraft);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nopeUploadBusy, setNopeUploadBusy] = useState(false);
  const [nopeUploadError, setNopeUploadError] = useState<string | null>(null);
  const [step2UploadBusy, setStep2UploadBusy] = useState(false);
  const [step2UploadError, setStep2UploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nopeFileInputRef = useRef<HTMLInputElement | null>(null);
  const step2FileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(action.text);
    setImageRef(action.imageRef ?? '');
    setLinkUrl(action.linkUrl ?? '');
    setAssignedPlayer(action.assignedPlayer ?? 'any');
    const nextActionUnit: 'seconds' | 'minutes' = action.timerUnit ?? 'seconds';
    setActionTimerUnit(nextActionUnit);
    setActionTimerDraft(formatTimerDraft(action.timerSeconds ?? null, nextActionUnit));
    setNopeText(action.nopeAlternative?.text ?? '');
    setNopeImageRef(action.nopeAlternative?.imageRef ?? '');
    const nextNopeUnit: 'seconds' | 'minutes' = action.nopeAlternative?.timerUnit ?? 'seconds';
    setNopeTimerUnit(nextNopeUnit);
    setNopeTimerDraft(formatTimerDraft(action.nopeAlternative?.timerSeconds ?? null, nextNopeUnit));
    setStep2Text(action.secondStep?.text ?? '');
    setStep2ImageRef(action.secondStep?.imageRef ?? '');
    const nextStep2Unit: 'seconds' | 'minutes' = action.secondStep?.timerUnit ?? 'seconds';
    setStep2TimerUnit(nextStep2Unit);
    setStep2TimerDraft(formatTimerDraft(action.secondStep?.timerSeconds ?? null, nextStep2Unit));
  }, [
    action.imageRef,
    action.linkUrl,
    action.text,
    action.assignedPlayer,
    action.timerSeconds,
    action.timerUnit,
    action.nopeAlternative?.imageRef,
    action.nopeAlternative?.text,
    action.nopeAlternative?.timerSeconds,
    action.nopeAlternative?.timerUnit,
    action.secondStep?.imageRef,
    action.secondStep?.text,
    action.secondStep?.timerSeconds,
    action.secondStep?.timerUnit
  ]);

  const computeTimerSeconds = (draft: string, unit: 'seconds' | 'minutes'): number | null => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }
    const seconds = Math.round(numeric);
    return seconds > 0 ? seconds : null;
  };

  const buildNopePayload = (
    nextText: string,
    nextImageRef: string,
    timerDraft: string,
    timerUnit: 'seconds' | 'minutes'
  ) => {
    const trimmedText = nextText.trim();
    const trimmedImage = nextImageRef.trim();
    if (!trimmedText && !trimmedImage) {
      return null;
    }
    return {
      text: trimmedText,
      imageRef: trimmedImage || null,
      timerSeconds: computeTimerSeconds(timerDraft, timerUnit),
      timerUnit
    };
  };

  const buildSecondStepPayload = (
    nextText: string,
    nextImageRef: string,
    timerDraft: string,
    timerUnit: 'seconds' | 'minutes'
  ) => {
    const trimmedText = nextText.trim();
    const trimmedImage = nextImageRef.trim();
    if (!trimmedText && !trimmedImage) {
      return null;
    }
    return {
      text: trimmedText,
      imageRef: trimmedImage || null,
      timerSeconds: computeTimerSeconds(timerDraft, timerUnit),
      timerUnit
    };
  };

  const save = (overrides?: {
    imageRef?: string;
    nopeImageRef?: string;
    nopeTimerDraft?: string;
    nopeTimerUnit?: 'seconds' | 'minutes';
    actionTimerDraft?: string;
    actionTimerUnit?: 'seconds' | 'minutes';
    step2ImageRef?: string;
    step2TimerDraft?: string;
    step2TimerUnit?: 'seconds' | 'minutes';
    assignedPlayer?: 'any' | 'P1' | 'P2';
  }) => {
    const nextImage = overrides?.imageRef ?? imageRef;
    const nextNopeImage = overrides?.nopeImageRef ?? nopeImageRef;
    const nextNopeTimerDraft = overrides?.nopeTimerDraft ?? nopeTimerDraft;
    const nextNopeTimerUnit = overrides?.nopeTimerUnit ?? nopeTimerUnit;
    const nextActionTimerDraft = overrides?.actionTimerDraft ?? actionTimerDraft;
    const nextActionTimerUnit = overrides?.actionTimerUnit ?? actionTimerUnit;
    const nextStep2Image = overrides?.step2ImageRef ?? step2ImageRef;
    const nextStep2TimerDraft = overrides?.step2TimerDraft ?? step2TimerDraft;
    const nextStep2TimerUnit = overrides?.step2TimerUnit ?? step2TimerUnit;
    const nextAssignedPlayer = overrides?.assignedPlayer ?? assignedPlayer;
    updateRoundRandomAction(
      roundNumber,
      index,
      text,
      nextImage || null,
      linkUrl || null,
      nextAssignedPlayer,
      computeTimerSeconds(nextActionTimerDraft, nextActionTimerUnit),
      nextActionTimerUnit,
      buildSecondStepPayload(step2Text, nextStep2Image, nextStep2TimerDraft, nextStep2TimerUnit),
      buildNopePayload(nopeText, nextNopeImage, nextNopeTimerDraft, nextNopeTimerUnit)
    );
  };

  return (
    <li className="rounded border p-3">
      <div className="grid gap-2 md:grid-cols-[90px_1fr_1fr_1fr_auto] md:items-end">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Action {index + 1}</span>
        <label className="text-sm">
          Instruction Text
          <textarea
            className="mt-1 w-full resize-y rounded border px-2 py-1 text-sm"
            onChange={(event) => setText(event.target.value)}
            rows={2}
            value={text}
          />
        </label>
        <label className="text-sm">
          Image URL (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setImageRef(event.target.value)}
            placeholder="https://example.com/image.png"
            type="url"
            value={imageRef}
          />
        </label>
        <label className="text-sm">
          Link URL (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            type="url"
            value={linkUrl}
          />
        </label>
        <label className="text-sm md:col-start-2 md:col-span-3">
          Assigned Player
          <select
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => {
              const next = event.target.value === 'P1' || event.target.value === 'P2' ? event.target.value : 'any';
              setAssignedPlayer(next);
              save({ assignedPlayer: next });
            }}
            value={assignedPlayer}
          >
            <option value="any">Any player</option>
            <option value="P1">P1 only</option>
            <option value="P2">P2 only</option>
          </select>
        </label>
        <button
          className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
          onClick={() => save()}
          type="button"
        >
          Save
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={uploadBusy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }

            setUploadBusy(true);
            setUploadError(null);
            try {
              const publicUrl = await uploadMediaFile(file);
              setImageRef(publicUrl);
              save({ imageRef: publicUrl });
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : 'Upload failed.');
            } finally {
              setUploadBusy(false);
              event.currentTarget.value = '';
            }
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploadBusy ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>
      {imageRef && isValidSpinnerImageUrl(imageRef) ? <ImagePreview imageRef={imageRef} /> : null}
      {linkUrl ? <p className="mt-2 text-xs text-slate-600">Link: {linkUrl}</p> : null}
      {uploadError ? <p className="mt-2 text-xs text-amber-700">{uploadError}</p> : null}

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm">
          Action Timer Duration (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            inputMode="decimal"
            min={0}
            onChange={(event) => setActionTimerDraft(event.target.value)}
            placeholder={actionTimerUnit === 'minutes' ? 'e.g. 1.5' : 'e.g. 10'}
            step={actionTimerUnit === 'minutes' ? '0.01' : '1'}
            type="number"
            value={actionTimerDraft}
          />
        </label>
        <label className="text-sm">
          Unit
          <select
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => {
              const nextUnit = event.target.value === 'minutes' ? 'minutes' : 'seconds';
              setActionTimerUnit(nextUnit);
              save({ actionTimerUnit: nextUnit });
            }}
            value={actionTimerUnit}
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
          </select>
        </label>
        <button
          className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
          onClick={() => save()}
          type="button"
        >
          Save
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        When set, a Start Timer button appears on this action&apos;s modal. Applies to the base step whether or not Step 2 is configured.
      </p>

      <div className="mt-3 rounded border border-dashed p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Step 2 (optional)</p>
        <p className="mt-1 text-xs text-slate-500">
          If set, the action runs as a two-step sequence. Step 1 (above) shows a Next button; Step 2 shows the Got It (and Nope, if configured) button.
          Each step can carry its own optional timer.
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm">
            Step 2 Text
            <textarea
              className="mt-1 w-full resize-y rounded border px-2 py-1 text-sm"
              onChange={(event) => setStep2Text(event.target.value)}
              rows={2}
              value={step2Text}
            />
          </label>
          <label className="text-sm">
            Step 2 Image URL (optional)
            <input
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => setStep2ImageRef(event.target.value)}
              placeholder="https://example.com/image.png"
              type="url"
              value={step2ImageRef}
            />
          </label>
          <button
            className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
            onClick={() => save()}
            type="button"
          >
            Save
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={step2UploadBusy}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }

              setStep2UploadBusy(true);
              setStep2UploadError(null);
              try {
                const publicUrl = await uploadMediaFile(file);
                setStep2ImageRef(publicUrl);
                save({ step2ImageRef: publicUrl });
              } catch (error) {
                setStep2UploadError(error instanceof Error ? error.message : 'Upload failed.');
              } finally {
                setStep2UploadBusy(false);
                event.currentTarget.value = '';
              }
            }}
            ref={step2FileInputRef}
            type="file"
          />
          <button
            className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
            disabled={step2UploadBusy}
            onClick={() => step2FileInputRef.current?.click()}
            type="button"
          >
            {step2UploadBusy ? 'Uploading...' : 'Upload Step 2 Image'}
          </button>
          {step2Text || step2ImageRef ? (
            <button
              className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
              onClick={() => {
                setStep2Text('');
                setStep2ImageRef('');
                setStep2TimerDraft('');
                save({ step2ImageRef: '', step2TimerDraft: '' });
              }}
              type="button"
            >
              Clear Step 2
            </button>
          ) : null}
        </div>
        {step2ImageRef && isValidSpinnerImageUrl(step2ImageRef) ? <ImagePreview imageRef={step2ImageRef} /> : null}
        {step2UploadError ? <p className="mt-2 text-xs text-amber-700">{step2UploadError}</p> : null}
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm">
            Step 2 Timer Duration (optional)
            <input
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              inputMode="decimal"
              min={0}
              onChange={(event) => setStep2TimerDraft(event.target.value)}
              placeholder={step2TimerUnit === 'minutes' ? 'e.g. 1.5' : 'e.g. 10'}
              step={step2TimerUnit === 'minutes' ? '0.01' : '1'}
              type="number"
              value={step2TimerDraft}
            />
          </label>
          <label className="text-sm">
            Unit
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => setStep2TimerUnit(event.target.value === 'minutes' ? 'minutes' : 'seconds')}
              value={step2TimerUnit}
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </label>
          <button
            className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
            onClick={() => save()}
            type="button"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-3 rounded border border-dashed p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Nope Alternative (optional)</p>
        <p className="mt-1 text-xs text-slate-500">
          If set, a Nope button appears on this random instruction so the player can opt out and see this replacement task instead.
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm">
            Nope Task Text
            <textarea
              className="mt-1 w-full resize-y rounded border px-2 py-1 text-sm"
              onChange={(event) => setNopeText(event.target.value)}
              rows={2}
              value={nopeText}
            />
          </label>
          <label className="text-sm">
            Nope Image URL (optional)
            <input
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => setNopeImageRef(event.target.value)}
              placeholder="https://example.com/image.png"
              type="url"
              value={nopeImageRef}
            />
          </label>
          <button
            className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
            onClick={() => save()}
            type="button"
          >
            Save
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={nopeUploadBusy}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }

              setNopeUploadBusy(true);
              setNopeUploadError(null);
              try {
                const publicUrl = await uploadMediaFile(file);
                setNopeImageRef(publicUrl);
                save({ nopeImageRef: publicUrl });
              } catch (error) {
                setNopeUploadError(error instanceof Error ? error.message : 'Upload failed.');
              } finally {
                setNopeUploadBusy(false);
                event.currentTarget.value = '';
              }
            }}
            ref={nopeFileInputRef}
            type="file"
          />
          <button
            className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
            disabled={nopeUploadBusy}
            onClick={() => nopeFileInputRef.current?.click()}
            type="button"
          >
            {nopeUploadBusy ? 'Uploading...' : 'Upload Nope Image'}
          </button>
          {nopeText || nopeImageRef ? (
            <button
              className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
              onClick={() => {
                setNopeText('');
                setNopeImageRef('');
                updateRoundRandomAction(
                  roundNumber,
                  index,
                  text,
                  imageRef || null,
                  linkUrl || null,
                  assignedPlayer,
                  computeTimerSeconds(actionTimerDraft, actionTimerUnit),
                  actionTimerUnit,
                  buildSecondStepPayload(step2Text, step2ImageRef, step2TimerDraft, step2TimerUnit),
                  null
                );
              }}
              type="button"
            >
              Clear Nope
            </button>
          ) : null}
        </div>
        {nopeImageRef && isValidSpinnerImageUrl(nopeImageRef) ? <ImagePreview imageRef={nopeImageRef} /> : null}
        {nopeUploadError ? <p className="mt-2 text-xs text-amber-700">{nopeUploadError}</p> : null}
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm">
            Nope Timer Duration (optional)
            <input
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              inputMode="decimal"
              min={0}
              onChange={(event) => setNopeTimerDraft(event.target.value)}
              placeholder={nopeTimerUnit === 'minutes' ? 'e.g. 1.5' : 'e.g. 10'}
              step={nopeTimerUnit === 'minutes' ? '0.01' : '1'}
              type="number"
              value={nopeTimerDraft}
            />
          </label>
          <label className="text-sm">
            Unit
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => {
                const nextUnit = event.target.value === 'minutes' ? 'minutes' : 'seconds';
                setNopeTimerUnit(nextUnit);
              }}
              value={nopeTimerUnit}
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </label>
          <button
            className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
            onClick={() => save()}
            type="button"
          >
            Save
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          When set, a Start Timer button appears on the Nope task modal. Leave empty to hide the timer.
        </p>
      </div>
    </li>
  );
}

function PlayerImageEditor({ player, imageRef }: { player: Player; imageRef: string | null }) {
  const updatePlayerImage = useGameStore((state) => state.updatePlayerImage);
  const [draft, setDraft] = useState(imageRef ?? '');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(imageRef ?? '');
  }, [imageRef]);

  return (
    <li className="rounded border p-3">
      <div className="grid gap-2 md:grid-cols-[90px_1fr_auto] md:items-end">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{player} Image</span>
        <label className="text-sm">
          Image URL
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="https://example.com/player-image.png"
            type="url"
            value={draft}
          />
        </label>
        <button className="btn-luxe rounded px-3 py-2 text-sm font-semibold" onClick={() => updatePlayerImage(player, draft || null)} type="button">
          Save
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={uploadBusy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }

            setUploadBusy(true);
            setUploadError(null);
            try {
              const publicUrl = await uploadMediaFile(file);
              setDraft(publicUrl);
              updatePlayerImage(player, publicUrl);
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : 'Upload failed.');
            } finally {
              setUploadBusy(false);
              event.currentTarget.value = '';
            }
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploadBusy ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>
      {draft && isValidSpinnerImageUrl(draft) ? <ImagePreview imageRef={draft} /> : null}
      {uploadError ? <p className="mt-2 text-xs text-amber-700">{uploadError}</p> : null}
    </li>
  );
}

function RoundIntroEditor({ round }: { round: Round }) {
  const updateRoundIntro = useGameStore((state) => state.updateRoundIntro);
  const [introText, setIntroText] = useState(round.introText);
  const [imageRef, setImageRef] = useState(round.introImageRef ?? '');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIntroText(round.introText);
    setImageRef(round.introImageRef ?? '');
  }, [round.introImageRef, round.introText]);

  return (
    <div className="mt-3 rounded border border-dashed p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Round Intro Modal Content</p>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm">
          Intro Text
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setIntroText(event.target.value)}
            placeholder="A custom line shown in the round intro modal"
            type="text"
            value={introText}
          />
        </label>
        <label className="text-sm">
          Intro Image URL (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setImageRef(event.target.value)}
            placeholder="https://example.com/round-intro.png"
            type="url"
            value={imageRef}
          />
        </label>
        <button
          className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
          onClick={() => updateRoundIntro(round.roundNumber, introText, imageRef || null)}
          type="button"
        >
          Save Intro
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={uploadBusy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }

            setUploadBusy(true);
            setUploadError(null);
            try {
              const publicUrl = await uploadMediaFile(file);
              setImageRef(publicUrl);
              updateRoundIntro(round.roundNumber, introText, publicUrl);
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : 'Upload failed.');
            } finally {
              setUploadBusy(false);
              event.currentTarget.value = '';
            }
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploadBusy ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>
      {imageRef && isValidSpinnerImageUrl(imageRef) ? <ImagePreview imageRef={imageRef} /> : null}
      {uploadError ? <p className="mt-2 text-xs text-amber-700">{uploadError}</p> : null}
    </div>
  );
}

function AudioTrackEditor({
  label,
  track,
  value
}: {
  label: string;
  track: 'timerEndAudioRef' | 'roundIntroAudioRef' | 'randomActionAudioRef';
  value: string | null;
}) {
  const updateAudioTrackUrl = useGameStore((state) => state.updateAudioTrackUrl);
  const [draft, setDraft] = useState(value ?? '');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <li className="rounded border p-3">
      <div className="grid gap-2 md:grid-cols-[140px_1fr_auto] md:items-end">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
        <label className="text-sm">
          Audio URL
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="https://example.com/sound.mp3"
            type="url"
            value={draft}
          />
        </label>
        <button className="btn-luxe rounded px-3 py-2 text-sm font-semibold" onClick={() => updateAudioTrackUrl(track, draft || null)} type="button">
          Save
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
          className="hidden"
          disabled={uploadBusy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }

            setUploadBusy(true);
            setUploadError(null);
            try {
              const publicUrl = await uploadMediaFile(file);
              setDraft(publicUrl);
              updateAudioTrackUrl(track, publicUrl);
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : 'Upload failed.');
            } finally {
              setUploadBusy(false);
              event.currentTarget.value = '';
            }
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
          disabled={uploadBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploadBusy ? 'Uploading...' : 'Upload Audio'}
        </button>
      </div>
      {draft && isValidAudioUrl(draft) ? <audio className="mt-2 w-full" controls preload="none" src={draft} /> : null}
      {uploadError ? <p className="mt-2 text-xs text-amber-700">{uploadError}</p> : null}
    </li>
  );
}

export function DashboardShell() {
  const game = useGameStore((state) => state.game);
  const dashboardError = useGameStore((state) => state.dashboardError);
  const clearDashboardError = useGameStore((state) => state.clearDashboardError);
  const hydrateFromCloud = useGameStore((state) => state.hydrateFromCloud);
  const updateRulesText = useGameStore((state) => state.updateRulesText);
  const updateResultInfoText = useGameStore((state) => state.updateResultInfoText);
  const updateGameOverChallenge = useGameStore((state) => state.updateGameOverChallenge);
  const updateSideVideoUrl = useGameStore((state) => state.updateSideVideoUrl);
  const localVideoObjectUrl = useGameStore((state) => state.localVideoObjectUrl);
  const setLocalVideoObjectUrl = useGameStore((state) => state.setLocalVideoObjectUrl);
  const updateAudioMuted = useGameStore((state) => state.updateAudioMuted);
  const updateAudioVolume = useGameStore((state) => state.updateAudioVolume);
  const updateRoundName = useGameStore((state) => state.updateRoundName);
  const updateRoundChickenOutText = useGameStore((state) => state.updateRoundChickenOutText);
  const addRound = useGameStore((state) => state.addRound);
  const addSpinnerEntry = useGameStore((state) => state.addSpinnerEntry);

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (typeof window === 'undefined') {
      return 'rounds';
    }

    const params = new URLSearchParams(window.location.search);
    return normalizeTab(params.get('tab'));
  });

  const [rulesDraft, setRulesDraft] = useState(game.rulesText);
  const [resultInfoDraft, setResultInfoDraft] = useState(game.resultInfoText ?? '');
  const [gameOverActionDraft, setGameOverActionDraft] = useState(game.gameOverChallenge?.actionText ?? '');
  const [gameOverTimerDraft, setGameOverTimerDraft] = useState(String(game.gameOverChallenge?.timerSeconds ?? ''));
  const [gameOverTimerUnit, setGameOverTimerUnit] = useState<'seconds' | 'minutes'>(game.gameOverChallenge?.timerUnit ?? 'seconds');
  const [sideVideoUrlDraft, setSideVideoUrlDraft] = useState(game.sideVideoUrl ?? '');
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(game.session.currentRoundNumber);
  const [audioVolumeDraft, setAudioVolumeDraft] = useState(String(Math.round(game.audioSettings.volume * 100)));
  const [selectedSpinnerType, setSelectedSpinnerType] = useState<SpinnerType>('part');
  const [newEntryText, setNewEntryText] = useState('');
  const [newEntryImageRef, setNewEntryImageRef] = useState('');
  const [newUploadBusy, setNewUploadBusy] = useState(false);
  const [newUploadError, setNewUploadError] = useState<string | null>(null);
  const newEntryFileInputRef = useRef<HTMLInputElement | null>(null);
  const localVideoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void hydrateFromCloud();
  }, [hydrateFromCloud]);

  useEffect(() => {
    setRulesDraft(game.rulesText);
  }, [game.rulesText]);

  useEffect(() => {
    setResultInfoDraft(game.resultInfoText ?? '');
  }, [game.resultInfoText]);

  useEffect(() => {
    setGameOverActionDraft(game.gameOverChallenge?.actionText ?? '');
    setGameOverTimerDraft(String(game.gameOverChallenge?.timerSeconds ?? ''));
    setGameOverTimerUnit(game.gameOverChallenge?.timerUnit ?? 'seconds');
  }, [game.gameOverChallenge]);

  useEffect(() => {
    setSideVideoUrlDraft(game.sideVideoUrl ?? '');
  }, [game.sideVideoUrl]);

  useEffect(() => {
    if (localVideoObjectUrl) return;
    void loadLocalVideo().then((file) => {
      if (file) {
        setLocalVideoObjectUrl(URL.createObjectURL(file));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAudioVolumeDraft(String(Math.round(game.audioSettings.volume * 100)));
  }, [game.audioSettings.volume]);

  const selectedRound = useMemo(
    () => game.rounds.find((round) => round.roundNumber === selectedRoundNumber) ?? game.rounds[0],
    [game.rounds, selectedRoundNumber]
  );
  const isLastRound = selectedRoundNumber === game.rounds[game.rounds.length - 1]?.roundNumber;
  const isActionsOnlyRound = selectedRound?.mode === 'actions-only';
  const selectedEntries = selectedRound?.spinners[selectedSpinnerType] ?? [];

  useEffect(() => {
    if (isLastRound && selectedSpinnerType === 'part') {
      setSelectedSpinnerType('action');
    }
  }, [isLastRound, selectedSpinnerType]);

  useEffect(() => {
    if (isActionsOnlyRound) {
      const firstSpinRound = game.rounds.find((round) => round.mode === 'spin');
      if (firstSpinRound && firstSpinRound.roundNumber !== selectedRoundNumber) {
        setSelectedRoundNumber(firstSpinRound.roundNumber);
      }
    }
  }, [isActionsOnlyRound, game.rounds, selectedRoundNumber]);

  const changeTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <main className={PAGE_CONTAINER_CLASS}>
      <nav className="glass-panel mb-4 flex items-center justify-between rounded-xl p-3">
        <h1 className="heading-elegant text-3xl font-semibold">Dashboard</h1>
        <div className="flex gap-3 text-sm font-medium">
          <Link className="underline" href="/">
            Gameplay
          </Link>
          <Link className="underline" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      {dashboardError ? (
        <p className="mb-3 rounded bg-rose-100 p-2 text-sm text-rose-700">
          {dashboardError}{' '}
          <button className="underline" onClick={clearDashboardError} type="button">
            Dismiss
          </button>
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="glass-card rounded-xl p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</p>
          <div aria-label="Dashboard sections" className="flex gap-2 md:flex-col" role="tablist">
            {(['rounds', 'spinners', 'rules', 'previews'] as DashboardTab[]).map((tab) => (
              <button
                aria-selected={activeTab === tab}
                className={`rounded px-3 py-2 text-left text-sm ${activeTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
                key={tab}
                onClick={() => changeTab(tab)}
                role="tab"
                type="button"
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </aside>

        <article className="glass-card rounded-xl p-4">
          {activeTab === 'rounds' ? (
            <section aria-labelledby="rounds-heading" role="tabpanel">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold" id="rounds-heading">
                  Rounds ({game.rounds.length}/{MAX_ROUNDS})
                </h2>
                <button
                  className="btn-luxe rounded px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={game.rounds.length >= MAX_ROUNDS}
                  onClick={addRound}
                  type="button"
                >
                  Add Round
                </button>
              </div>

              <ol className="space-y-2">
                {game.rounds.map((round) => (
                  <li className="rounded border p-3" key={round.roundNumber}>
                    <div className="grid gap-2 md:grid-cols-[120px_1fr_120px] md:items-center">
                      <span className="text-sm font-medium">Round {round.roundNumber}</span>
                      <input
                        aria-label={`Round ${round.roundNumber} name`}
                        className="rounded border px-2 py-1 text-sm"
                        defaultValue={round.name}
                        onBlur={(event) => updateRoundName(round.roundNumber, event.target.value)}
                        type="text"
                      />
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-center text-xs">Total turns: {round.totalTurns}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-center text-xs ${
                          round.mode === 'actions-only' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        Mode: {round.mode === 'actions-only' ? 'Actions Only' : 'Spin'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-600" htmlFor={`chicken-out-${round.roundNumber}`}>
                        Chicken Out option (shown in spin result modal — leave blank to hide)
                      </label>
                      <input
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        defaultValue={round.chickenOutText}
                        id={`chicken-out-${round.roundNumber}`}
                        maxLength={280}
                        onBlur={(event) => updateRoundChickenOutText(round.roundNumber, event.target.value)}
                        placeholder="e.g. Take a sip instead"
                        type="text"
                      />
                    </div>
                    <RoundIntroEditor round={round} />
                    <div className="mt-3 rounded border border-dashed p-3">
                      <h4 className="text-sm font-semibold">Round Random Actions ({round.randomActions.length})</h4>
                      {round.randomActions.length > 0 ? (
                        <ol className="mt-2 space-y-2">
                          {round.randomActions.map((action, index) => (
                            <RandomActionEditor action={action} index={index} key={`round-${round.roundNumber}-random-${index}`} roundNumber={round.roundNumber} />
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-xs text-slate-600">
                          {round.mode === 'actions-only'
                            ? 'This round is action-only with no configured actions yet.'
                            : 'This round has no random actions (spinner only).'}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-600">Round order and per-round quotas are fixed for fair progression.</p>
            </section>
          ) : null}

          {activeTab === 'spinners' ? (
            <section aria-labelledby="spinners-heading" role="tabpanel">
              <h2 className="text-base font-semibold" id="spinners-heading">
                Spinner Entries
              </h2>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr]">
                <label className="text-sm">
                  Round
                  <select
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(event) => setSelectedRoundNumber(Number(event.target.value))}
                    value={selectedRound.roundNumber}
                  >
                    {game.rounds
                      .filter((round) => round.mode === 'spin')
                      .map((round) => (
                        <option key={round.roundNumber} value={round.roundNumber}>
                          {round.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Spinner Type
                  <select
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(event) => setSelectedSpinnerType(event.target.value as SpinnerType)}
                    value={selectedSpinnerType}
                  >
                    {!isLastRound && <option value="part">Body Part</option>}
                    <option value="action">Action</option>
                    <option value="timer">Timer</option>
                  </select>
                </label>
                {isLastRound ? (
                  <p className="col-span-2 text-xs text-slate-500">The last round only has Action and Timer spinners.</p>
                ) : null}
              </div>

              <ul className="mt-3 space-y-2">
                {selectedEntries.map((entry) => (
                  <SpinnerEntryEditor
                    entryId={entry.id}
                    initialImageRef={entry.imageRef}
                    initialText={entry.text}
                    key={entry.id}
                    roundNumber={selectedRound.roundNumber}
                    spinnerType={selectedSpinnerType}
                  />
                ))}
              </ul>

              {selectedEntries.length === 0 ? <p className="mt-3 text-sm text-slate-600">No entries yet for this spinner.</p> : null}

              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Add Entry</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <label className="text-sm">
                    Text
                    <input
                      className="mt-1 w-full rounded border px-2 py-1"
                      onChange={(event) => setNewEntryText(event.target.value)}
                      type="text"
                      value={newEntryText}
                    />
                  </label>
                  <label className="text-sm">
                    Image URL (optional)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1"
                      onChange={(event) => setNewEntryImageRef(event.target.value)}
                      placeholder="https://example.com/image.png"
                      type="url"
                      value={newEntryImageRef}
                    />
                  </label>
                  <button
                    className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
                    onClick={() => {
                      const created = addSpinnerEntry(
                        selectedRound.roundNumber,
                        selectedSpinnerType,
                        newEntryText,
                        newEntryImageRef || null
                      );

                      if (created) {
                        setNewEntryText('');
                        setNewEntryImageRef('');
                      }
                    }}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={newUploadBusy}
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      if (!file) {
                        return;
                      }

                      setNewUploadBusy(true);
                      setNewUploadError(null);
                      try {
                        const publicUrl = await uploadMediaFile(file);
                        setNewEntryImageRef(publicUrl);
                      } catch (error) {
                        setNewUploadError(error instanceof Error ? error.message : 'Upload failed.');
                      } finally {
                        setNewUploadBusy(false);
                        event.currentTarget.value = '';
                      }
                    }}
                    ref={newEntryFileInputRef}
                    type="file"
                  />
                  <button
                    className="btn-luxe-outline rounded px-3 py-1.5 text-xs font-medium"
                    disabled={newUploadBusy}
                    onClick={() => newEntryFileInputRef.current?.click()}
                    type="button"
                  >
                    {newUploadBusy ? 'Uploading...' : 'Upload Image'}
                  </button>
                  <span className="text-slate-500">Upload an image file (optional)</span>
                </div>
                {newEntryImageRef && isValidSpinnerImageUrl(newEntryImageRef) ? <ImagePreview imageRef={newEntryImageRef} /> : null}
                {newUploadError ? <p className="mt-2 text-xs text-amber-700">{newUploadError}</p> : null}
              </div>
            </section>
          ) : null}

          {activeTab === 'rules' ? (
            <section aria-labelledby="rules-heading" role="tabpanel">
              <h2 className="text-base font-semibold" id="rules-heading">
                Rules
              </h2>
              <p className="mt-1 text-sm text-slate-600">Rules are informational only; gameplay is enforced by turn and round logic.</p>
              <textarea
                className="mt-3 min-h-56 w-full rounded border p-3 text-sm"
                onBlur={(event) => updateRulesText(event.target.value)}
                onChange={(event) => setRulesDraft(event.target.value)}
                value={rulesDraft}
              />
              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Spin Result Info Text</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Optional subtle line shown below the Done button on the spin result modal. Keep it informational rather than instructional.
                </p>
                <textarea
                  className="mt-2 min-h-16 w-full rounded border p-2 text-sm"
                  maxLength={280}
                  onBlur={(event) => updateResultInfoText(event.target.value)}
                  onChange={(event) => setResultInfoDraft(event.target.value)}
                  placeholder="e.g. Remember to have fun, stay safe, and breathe."
                  value={resultInfoDraft}
                />
                <p className="mt-1 text-right text-xs text-slate-500">{resultInfoDraft.length}/280</p>
              </div>
              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Side Video</h3>
                <p className="mt-1 text-xs text-slate-600">
                  This video appears in gameplay as a small side card. Use a YouTube link or pick a local file.
                </p>
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-700">Option 1 — YouTube Link</p>
                  <div className="mt-1 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="text-sm">
                      <input
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        onChange={(event) => setSideVideoUrlDraft(event.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        type="url"
                        value={sideVideoUrlDraft}
                      />
                    </label>
                    <button
                      className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
                      onClick={() => updateSideVideoUrl(sideVideoUrlDraft || null)}
                      type="button"
                    >
                      Save
                    </button>
                  </div>
                  {sideVideoUrlDraft && !isValidYouTubeUrl(sideVideoUrlDraft) ? (
                    <p className="mt-1 text-xs text-amber-700">Please use a valid YouTube URL (`youtube.com` or `youtu.be`).</p>
                  ) : null}
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-700">Option 2 — Local File (this session only)</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const prev = localVideoObjectUrl;
                        const next = URL.createObjectURL(file);
                        setLocalVideoObjectUrl(next);
                        if (prev) URL.revokeObjectURL(prev);
                        void saveLocalVideo(file);
                        event.target.value = '';
                      }}
                      ref={localVideoFileInputRef}
                      type="file"
                    />
                    <button
                      className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
                      onClick={() => localVideoFileInputRef.current?.click()}
                      type="button"
                    >
                      {localVideoObjectUrl ? 'Change File' : 'Choose File'}
                    </button>
                    {localVideoObjectUrl ? (
                      <button
                        className="rounded border px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                        onClick={() => {
                          URL.revokeObjectURL(localVideoObjectUrl);
                          setLocalVideoObjectUrl(null);
                          void clearLocalVideo();
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    ) : null}
                    {localVideoObjectUrl ? (
                      <span className="text-xs text-green-700">Local file loaded</span>
                    ) : (
                      <span className="text-xs text-slate-500">No local file selected</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Local file is not saved — you will need to re-select it after a page refresh.</p>
                </div>
              </div>
              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Player Turn Images</h3>
                <p className="mt-1 text-xs text-slate-600">Used in the centered active-player card above the spinner.</p>
                <ol className="mt-3 space-y-2">
                  <PlayerImageEditor imageRef={game.playerImages.P1} player="P1" />
                  <PlayerImageEditor imageRef={game.playerImages.P2} player="P2" />
                </ol>
              </div>
              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Game Audio</h3>
                <p className="mt-1 text-xs text-slate-600">Set separate sounds for timer end and round intro. Files are persisted with the game config.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input checked={game.audioSettings.muted} onChange={(event) => updateAudioMuted(event.target.checked)} type="checkbox" />
                    Mute all game sounds
                  </label>
                  <label className="text-sm">
                    Volume ({audioVolumeDraft}%)
                    <input
                      className="mt-1 w-full"
                      max={100}
                      min={0}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setAudioVolumeDraft(String(value));
                        updateAudioVolume(value / 100);
                      }}
                      type="range"
                      value={audioVolumeDraft}
                    />
                  </label>
                  <button className="btn-luxe-outline rounded px-3 py-1.5 text-xs" onClick={() => updateAudioVolume(0.7)} type="button">
                    Reset 70%
                  </button>
                </div>
                <ol className="mt-3 space-y-2">
                  <AudioTrackEditor label="Timer End Sound" track="timerEndAudioRef" value={game.audioSettings.timerEndAudioRef} />
                  <AudioTrackEditor label="Round Intro Sound" track="roundIntroAudioRef" value={game.audioSettings.roundIntroAudioRef} />
                  <AudioTrackEditor label="Random Action Sound" track="randomActionAudioRef" value={game.audioSettings.randomActionAudioRef} />
                </ol>
              </div>
              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Game Over Challenge</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Shown in the &quot;Game Over...or is it?&quot; modal after the final round. Leave action blank to show a fallback message.
                </p>
                <label className="mt-3 block text-sm">
                  Final Action Text
                  <textarea
                    className="mt-1 min-h-20 w-full rounded border p-2 text-sm"
                    maxLength={4000}
                    onBlur={() => updateGameOverChallenge(gameOverActionDraft, gameOverTimerDraft ? Number(gameOverTimerDraft) : null, gameOverTimerUnit)}
                    onChange={(event) => setGameOverActionDraft(event.target.value)}
                    placeholder="e.g. One last kiss that lasts as long as the timer..."
                    value={gameOverActionDraft}
                  />
                  <span className="mt-1 block text-right text-xs text-slate-500">{gameOverActionDraft.length}/4000</span>
                </label>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <label className="text-sm">
                    Timer Duration (optional)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      min={1}
                      onBlur={() => updateGameOverChallenge(gameOverActionDraft, gameOverTimerDraft ? Number(gameOverTimerDraft) : null, gameOverTimerUnit)}
                      onChange={(event) => setGameOverTimerDraft(event.target.value)}
                      placeholder="e.g. 30"
                      type="number"
                      value={gameOverTimerDraft}
                    />
                  </label>
                  <label className="text-sm">
                    Unit
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      onChange={(event) => {
                        const unit = event.target.value as 'seconds' | 'minutes';
                        setGameOverTimerUnit(unit);
                        updateGameOverChallenge(gameOverActionDraft, gameOverTimerDraft ? Number(gameOverTimerDraft) : null, unit);
                      }}
                      value={gameOverTimerUnit}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </label>
                  <button
                    className="btn-luxe rounded px-3 py-2 text-sm font-semibold"
                    onClick={() => updateGameOverChallenge(gameOverActionDraft, gameOverTimerDraft ? Number(gameOverTimerDraft) : null, gameOverTimerUnit)}
                    type="button"
                  >
                    Save
                  </button>
                </div>
                {gameOverTimerDraft && (Number(gameOverTimerDraft) <= 0 || !Number.isFinite(Number(gameOverTimerDraft))) ? (
                  <p className="mt-1 text-xs text-amber-700">Timer must be a positive number.</p>
                ) : null}
              </div>
              <div className="mt-4 rounded border border-dashed p-3">
                <h3 className="text-sm font-semibold">Round-Based Random Actions</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Configure random actions in each round card under the Rounds tab.
                </p>
              </div>
            </section>
          ) : null}

          {activeTab === 'previews' ? <PreviewsPanel /> : null}
        </article>
      </section>
    </main>
  );
}

function PreviewsPanel() {
  const game = useGameStore((state) => state.game);
  type PreviewKind = 'result' | 'randomInstruction' | 'nopeTask' | 'roundIntro' | 'rules';
  const [selectedPreview, setSelectedPreview] = useState<PreviewKind>('result');
  const [previewRoundNumber, setPreviewRoundNumber] = useState<number>(
    game.rounds[0]?.roundNumber ?? 1
  );
  const [previewActionIndex, setPreviewActionIndex] = useState<number>(0);
  const [previewRandomStep, setPreviewRandomStep] = useState<1 | 2>(1);
  const [previewPartEntryId, setPreviewPartEntryId] = useState<string>('');
  const [previewActionEntryId, setPreviewActionEntryId] = useState<string>('');
  const [previewTimerEntryId, setPreviewTimerEntryId] = useState<string>('');
  const [previewTaskPlayer, setPreviewTaskPlayer] = useState<Player>('P1');

  const previewRound = useMemo(
    () => game.rounds.find((round) => round.roundNumber === previewRoundNumber) ?? game.rounds[0],
    [game.rounds, previewRoundNumber]
  );
  const previewIsLastRound =
    previewRound?.roundNumber === game.rounds[game.rounds.length - 1]?.roundNumber;

  const previewRandomAction: RandomAction | null = useMemo(() => {
    if (!previewRound || previewRound.randomActions.length === 0) {
      return null;
    }
    const safeIndex = Math.min(Math.max(0, previewActionIndex), previewRound.randomActions.length - 1);
    return previewRound.randomActions[safeIndex] ?? null;
  }, [previewRound, previewActionIndex]);

  const partEntries = previewRound?.spinners.part ?? [];
  const actionEntries = previewRound?.spinners.action ?? [];
  const timerEntries = previewRound?.spinners.timer ?? [];

  const resolveSpinEntry = (
    entries: { id: string; text: string; imageRef: string | null }[],
    selectedId: string,
    label: string
  ) => {
    const selected = entries.find((entry) => entry.id === selectedId);
    if (selected) {
      return { text: selected.text || label, imageRef: selected.imageRef, fromFallback: false };
    }
    const first = entries[0];
    if (first) {
      return { text: first.text || label, imageRef: first.imageRef, fromFallback: false };
    }
    return { text: label, imageRef: null, fromFallback: true };
  };

  const partItem = previewIsLastRound ? null : resolveSpinEntry(partEntries, previewPartEntryId, 'Body Part');
  const actionItem = resolveSpinEntry(actionEntries, previewActionEntryId, 'Action');
  const timerItem = resolveSpinEntry(timerEntries, previewTimerEntryId, 'Timer');

  const parseSourceSeconds = (rawText: string | null | undefined): number => {
    if (!rawText) {
      return 10;
    }
    const match = rawText.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return 10;
    }
    const numeric = Number.parseFloat(match[1]);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 10;
    }
    const lower = rawText.toLowerCase();
    if (lower.includes('m')) {
      return Math.round(numeric * 60);
    }
    return Math.round(numeric);
  };

  return (
    <section aria-labelledby="previews-heading" role="tabpanel">
      <h2 className="text-base font-semibold" id="previews-heading">
        Modal Previews
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Static previews of every modal with no side effects. Buttons and timers are non-interactive.
      </p>

      <div className="mt-4 rounded border border-dashed p-3">
        <label className="text-sm">
          Modal
          <select
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            onChange={(event) => setSelectedPreview(event.target.value as PreviewKind)}
            value={selectedPreview}
          >
            <option value="result">Spin Result</option>
            <option value="randomInstruction">Random Instruction</option>
            <option value="nopeTask">Nope Task</option>
            <option value="roundIntro">Round Intro</option>
            <option value="rules">Rules</option>
          </select>
        </label>
      </div>

      {(selectedPreview === 'result' ||
        selectedPreview === 'randomInstruction' ||
        selectedPreview === 'nopeTask' ||
        selectedPreview === 'roundIntro') && (
        <div className="mt-3 rounded border border-dashed p-3">
          <label className="text-sm">
            Round
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => {
                setPreviewRoundNumber(Number(event.target.value));
                setPreviewActionIndex(0);
                setPreviewPartEntryId('');
                setPreviewActionEntryId('');
                setPreviewTimerEntryId('');
              }}
              value={previewRoundNumber}
            >
              {game.rounds.map((round) => (
                <option key={round.roundNumber} value={round.roundNumber}>
                  {round.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {selectedPreview === 'result' && previewRound ? (
        <div className="mt-3 grid gap-3 rounded border border-dashed p-3 md:grid-cols-2 xl:grid-cols-4">
          {!previewIsLastRound && (
            <label className="text-sm">
              Body Part Entry
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                onChange={(event) => setPreviewPartEntryId(event.target.value)}
                value={previewPartEntryId}
              >
                <option value="">(first / fallback)</option>
                {partEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.text || '(no text)'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            Action Entry
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => setPreviewActionEntryId(event.target.value)}
              value={previewActionEntryId}
            >
              <option value="">(first / fallback)</option>
              {actionEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.text || '(no text)'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Timer Entry
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => setPreviewTimerEntryId(event.target.value)}
              value={previewTimerEntryId}
            >
              <option value="">(first / fallback)</option>
              {timerEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.text || '(no text)'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Task Player
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              onChange={(event) => setPreviewTaskPlayer(event.target.value === 'P2' ? 'P2' : 'P1')}
              value={previewTaskPlayer}
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
          </label>
        </div>
      ) : null}

      {(selectedPreview === 'randomInstruction' || selectedPreview === 'nopeTask') && previewRound ? (
        <div className="mt-3 grid gap-3 rounded border border-dashed p-3 md:grid-cols-[1fr_auto]">
          <label className="text-sm">
            Random Action
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              disabled={previewRound.randomActions.length === 0}
              onChange={(event) => {
                setPreviewActionIndex(Number(event.target.value));
                setPreviewRandomStep(1);
              }}
              value={previewActionIndex}
            >
              {previewRound.randomActions.length === 0 ? (
                <option value={0}>(no random actions for this round)</option>
              ) : (
                previewRound.randomActions.map((action, idx) => (
                  <option key={idx} value={idx}>
                    Action {idx + 1} — {action.text || '(no text)'}
                  </option>
                ))
              )}
            </select>
          </label>
          {selectedPreview === 'randomInstruction' && previewRandomAction?.secondStep ? (
            <label className="text-sm">
              Step
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                onChange={(event) => setPreviewRandomStep(event.target.value === '2' ? 2 : 1)}
                value={previewRandomStep}
              >
                <option value={1}>Step 1</option>
                <option value={2}>Step 2</option>
              </select>
            </label>
          ) : null}
          {selectedPreview === 'nopeTask' && previewRandomAction && !previewRandomAction.nopeAlternative ? (
            <p className="col-span-full mt-2 text-xs text-amber-700">
              This random action has no Nope alternative configured. Pick another or add one in the Rounds tab.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        {selectedPreview === 'result' && previewRound && actionItem && timerItem ? (
          <SpinResultModalPreview
            actionItem={actionItem}
            initialSecondsLeft={parseSourceSeconds(timerItem.text)}
            isLastRound={previewIsLastRound}
            partItem={partItem}
            resultInfoText={game.resultInfoText ?? ''}
            taskPlayer={previewTaskPlayer}
            taskPlayerImage={game.playerImages[previewTaskPlayer]}
            timerItem={timerItem}
          />
        ) : null}

        {selectedPreview === 'randomInstruction' && previewRandomAction ? (
          <RandomInstructionModalPreview
            action={previewRandomAction}
            fallbackActivePlayer="P1"
            playerImages={game.playerImages}
            step={previewRandomAction.secondStep ? previewRandomStep : 1}
          />
        ) : null}
        {selectedPreview === 'randomInstruction' && !previewRandomAction ? (
          <p className="mt-2 text-sm text-slate-600">
            No random actions configured for this round. Add some in the Rounds tab.
          </p>
        ) : null}

        {selectedPreview === 'nopeTask' && previewRandomAction?.nopeAlternative ? (
          <NopeTaskModalPreview nope={previewRandomAction.nopeAlternative} />
        ) : null}
        {selectedPreview === 'nopeTask' && !previewRandomAction?.nopeAlternative ? (
          <p className="mt-2 text-sm text-slate-600">
            Pick a random action that has a Nope alternative set, or configure one in the Rounds tab.
          </p>
        ) : null}

        {selectedPreview === 'roundIntro' && previewRound ? (
          <RoundIntroModalPreview round={previewRound} />
        ) : null}

        {selectedPreview === 'rules' ? <RulesModalPreview rulesText={game.rulesText ?? ''} /> : null}
      </div>
    </section>
  );
}
