export const MIN_REASONABLE_TIME_SECONDS = 8 * 60;
export const MAX_REASONABLE_TIME_SECONDS = 3 * 3_600;

export function parseTimeToSeconds(time: string): number | null {
  const trimmed = time.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }

  // Excel day fractions, e.g. 0.03100694444444444
  if (/^0\.\d+$/.test(trimmed)) {
    const fraction = Number.parseFloat(trimmed);
    if (fraction > 0 && fraction < 1) {
      return Math.round(fraction * 86_400);
    }
    return null;
  }

  // Colon-separated times: hh:mm:ss, h:mm, or mm:ss
  if (/^\d+:\d{2}(:\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(":").map((part) => Number.parseInt(part, 10));
    if (parts.some((part) => Number.isNaN(part))) {
      return null;
    }

    if (parts.length === 3) {
      const [first, second, third] = parts;
      if (second >= 60 || third >= 60) {
        return null;
      }
      if (first === 0 || first <= 3) {
        return first * 3_600 + second * 60 + third;
      }
      if (first < 60) {
        return first * 60 + second;
      }
      return null;
    }

    const [first, second] = parts;
    if (second >= 60) {
      return null;
    }
    if (first <= 3) {
      return first * 3_600 + second * 60;
    }
    if (first < 60) {
      return first * 60 + second;
    }
    return null;
  }

  // minutes.seconds, e.g. 46.34
  const dotMatch = trimmed.match(/^(\d+)\.(\d+)$/);
  if (dotMatch) {
    const minutes = Number.parseInt(dotMatch[1], 10);
    const seconds = Number.parseInt(dotMatch[2], 10);
    if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds >= 60) {
      return null;
    }
    return minutes * 60 + seconds;
  }

  return null;
}

export function isUnreasonableTime(time: string | null | undefined): boolean {
  if (!time) {
    return false;
  }

  const seconds = parseTimeToSeconds(time);
  return (
    seconds !== null &&
    (seconds < MIN_REASONABLE_TIME_SECONDS || seconds > MAX_REASONABLE_TIME_SECONDS)
  );
}

export function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function isValidCorrectedTime(time: string): boolean {
  const seconds = parseTimeToSeconds(time.trim());
  return (
    seconds !== null &&
    seconds >= MIN_REASONABLE_TIME_SECONDS &&
    seconds <= MAX_REASONABLE_TIME_SECONDS
  );
}
