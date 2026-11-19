import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { createAlert, deleteAlert, listAlerts, updateAlert } from '../api/endpoints';
import type { AlertConfig, AlertConfigCreate, AlertConfigUpdate } from '../api/types';
import { useAuth } from './useAuth';

const ALERTS_KEY = ['alerts'] as const;

export function useAlerts() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Drop cached alerts on sign-out so the next user never sees them
  useEffect(() => {
    if (!isAuthenticated) queryClient.removeQueries({ queryKey: ALERTS_KEY });
  }, [isAuthenticated, queryClient]);

  return useQuery({
    queryKey: ALERTS_KEY,
    queryFn: listAlerts,
    enabled: isAuthenticated,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertConfigCreate) => createAlert(body),
    onSuccess: (created) => {
      queryClient.setQueryData<AlertConfig[]>(ALERTS_KEY, (old) => [...(old ?? []), created]);
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AlertConfigUpdate }) => updateAlert(id, body),
    // Optimistic so the enabled switch flips instantly; rolled back on error
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = queryClient.getQueryData<AlertConfig[]>(ALERTS_KEY);
      queryClient.setQueryData<AlertConfig[]>(ALERTS_KEY, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...body } : a)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ALERTS_KEY, ctx.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<AlertConfig[]>(ALERTS_KEY, (old) =>
        old?.map((a) => (a.id === updated.id ? updated : a)),
      );
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAlert(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<AlertConfig[]>(ALERTS_KEY, (old) => old?.filter((a) => a.id !== id));
    },
  });
}
