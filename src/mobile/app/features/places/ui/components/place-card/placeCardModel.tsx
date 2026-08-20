import { Flag, Pencil, Trash2 } from 'lucide-react-native';

import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { DeferredActionMenuSheet } from '@/mobile/app/shared/components/feedback/DeferredActionMenuSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';

type ActionMenuItem = React.ComponentProps<typeof DeferredActionMenuSheet>['items'][number];

function uniqueValues(values?: string[], fallback?: string) {
  if (values?.length) {
    return Array.from(new Set(values));
  }

  return fallback ? [fallback] : [];
}

export function getPlaceCardMetadata(place: Place) {
  const features = uniqueValues(place.specialFeatures);

  return {
    bestTimes: uniqueValues(place.bestTimes, place.bestTime),
    categories: uniqueValues(place.categories, place.category),
    dietaryOptions: features.filter((item) => PLACE_DIETARY_OPTIONS.includes(item)),
    specialFeatures: features.filter((item) => !PLACE_DIETARY_OPTIONS.includes(item)),
  };
}

export function createFallbackOwnedList(params: {
  canManage: boolean;
  listCoverImage?: string;
  listEmoji?: string;
  listId?: string;
  listIsPublic?: boolean;
  listName?: string;
  place: Place;
  user: User | null;
}): PlaceList | null {
  if (!params.canManage || !params.user || !params.listId) {
    return null;
  }

  return {
    id: params.listId,
    userId: params.user.id,
    name: params.listName || tr.cards.savedPlaceFallback,
    description: undefined,
    emoji: params.listEmoji,
    coverImage: params.listCoverImage,
    places: [params.place],
    isPublic: params.listIsPublic !== false,
    createdAt: params.place.addedAt,
    updatedAt: params.place.updatedAt || params.place.addedAt,
  };
}

export function includeFallbackList(lists: PlaceList[], fallback: PlaceList | null) {
  if (!fallback || lists.some((item) => item.id === fallback.id)) {
    return lists;
  }

  return [fallback, ...lists];
}

export function resolveOptionalPressHandler(
  configuredHandler: (() => void) | null | undefined,
  fallbackHandler: () => void,
) {
  if (configuredHandler === undefined) {
    return fallbackHandler;
  }

  return configuredHandler ?? undefined;
}

export function buildPlaceActionItems(params: {
  canManageOwnedPlace: boolean;
  canReportPlace: boolean;
  onDelete?: () => void;
  onDeletePress: () => void;
  onEdit?: () => void;
  onEditPress: () => void;
  onReportPress: () => void;
}) {
  const items: Array<ActionMenuItem | null> = [
    params.onEdit || params.canManageOwnedPlace
      ? {
          key: 'edit',
          label: tr.common.edit,
          renderIcon: (color) => <Pencil color={color} size={14} />,
          onPress: params.onEditPress,
        }
      : null,
    params.onDelete || params.canManageOwnedPlace
      ? {
          key: 'delete',
          label: tr.common.delete,
          renderIcon: (color) => <Trash2 color={color} size={14} />,
          tone: 'danger',
          onPress: params.onDeletePress,
        }
      : null,
    params.canReportPlace
      ? {
          key: 'report',
          label: tr.profile.actions.report,
          renderIcon: (color) => <Flag color={color} size={14} />,
          tone: 'danger',
          onPress: params.onReportPress,
        }
      : null,
  ];

  return items.filter((item): item is ActionMenuItem => Boolean(item));
}
