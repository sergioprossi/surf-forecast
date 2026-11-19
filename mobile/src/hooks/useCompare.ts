import { useQuery } from '@tanstack/react-query';

import { compareSpots } from '../api/endpoints';
import { REFETCH_INTERVAL } from '../utils/constants';

/** Compare spots at `time` (UTC ISO on the hour), or the current hour when null. */
export function useCompare(spotIds: string[], time: string | null) {
  return useQuery({
    queryKey: ['compare', spotIds, time],
    queryFn: () => compareSpots(spotIds, time ?? undefined),
    enabled: spotIds.length > 0,
    staleTime: REFETCH_INTERVAL,
    // Keep the previous result on screen while switching time chips
    placeholderData: (prev) => prev,
  });
}
