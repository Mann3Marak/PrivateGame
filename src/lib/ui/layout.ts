// Fallback switch: set to false to instantly restore the original compact width.
export const ENABLE_WIDE_LAYOUT = true;

export const PAGE_CONTAINER_CLASS = ENABLE_WIDE_LAYOUT
  ? 'mx-auto min-h-screen w-full max-w-5xl px-4 py-6 xl:max-w-[1400px] 2xl:max-w-[1700px]'
  : 'mx-auto min-h-screen max-w-5xl px-4 py-6';
