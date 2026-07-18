import { useMutation } from '@tanstack/react-query';

import { createPlaceQuoteNotification } from '@/mobile/app/data/repositories/notificationRepository';

export function useCreatePlaceQuoteNotificationMutation() {
  return useMutation({
    mutationKey: ['notifications', 'place-quote', 'create'],
    meta: {
      suppressGlobalErrorLog: true,
    },
    mutationFn: (input: {
      actorUserId: string;
      listId?: string | null;
      message: string;
      placeId?: string | null;
      recipientUserId: string;
    }) => createPlaceQuoteNotification(input),
  });
}
