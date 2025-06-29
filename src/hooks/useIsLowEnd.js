import { useMemo } from 'react';

/**
 * Attempt to detect low-end devices (mobile) so we can disable heavy effects.
 * Criteria:
 *   - Hardware threads <= 4 OR
 *   - Device memory <= 2 GB
 * Browsers that don't support these APIs will return undefined, so we assume high-end (false).
 */
export default function useIsLowEnd() {
  const isLowEnd = useMemo(() => {
    const hw = navigator.hardwareConcurrency ?? 8;
    const mem = navigator.deviceMemory ?? 4;
    return hw <= 4 || mem <= 2;
  }, []);

  return isLowEnd;
} 