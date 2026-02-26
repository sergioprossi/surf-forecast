import { useQuery } from '@tanstack/react-query';

import { getCurrentConditions, getBestWindows, getForecast, getSpots } from '../api/endpoints';
import { REFETCH_INTERVAL } from '../utils/constants';

export function useSpots() {
  return useQuery({
    queryKey: ['spots'],
    queryFn: getSpots,
    staleTime: 30 * 60 * 1000, // 30 min — spots rarely change
  });
}

export function useCurrentConditions() {
  return useQuery({
    queryKey: ['conditions'],
    queryFn: getCurrentConditions,
    staleTime: REFETCH_INTERVAL,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useBestWindows(minScore?: number) {
  return useQuery({
    queryKey: ['bestWindows', minScore],
    queryFn: () => getBestWindows(minScore),
    staleTime: REFETCH_INTERVAL,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useForecast(spotId: string) {
  return useQuery({
    queryKey: ['forecast', spotId],
    queryFn: () => getForecast(spotId),
    staleTime: 15 * 60 * 1000, // 15 min
    enabled: !!spotId,
  });
}
