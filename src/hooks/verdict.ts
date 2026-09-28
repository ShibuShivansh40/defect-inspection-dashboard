import { useUi } from '../store/ui';
import type { Frame } from '../types';

/** A frame FAILs when any detection clears the reject threshold. */
export function useVerdict(frame: Frame | undefined): 'pass' | 'fail' | undefined {
  const threshold = useUi((s) => s.threshold);
  if (!frame) return undefined;
  return frame.detections.some((d) => d.confidence >= threshold) ? 'fail' : 'pass';
}
