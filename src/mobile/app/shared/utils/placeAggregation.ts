import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';

export type PlaceListReference = {
  key: string;
  listId: string;
  placeId: string;
  userId: string;
  listName: string;
  listEmoji?: string;
  listIsPublic: boolean;
  listCoverImage?: string;
  listUpdatedAt: string;
  placeAddedAt: string;
  placeUpdatedAt: string;
  isLocked?: boolean;
};

export type PlaceFeedCardItem = {
  key: string;
  place: Place;
  owner?: User | null;
  ownerId: string;
  listId: string;
  listName: string;
  listEmoji?: string;
  listIsPublic: boolean;
  listCoverImage?: string;
  sortTime: number;
};

const PLACE_COORDINATE_PRECISION = 5;

function getPlaceSortTime(place: Pick<Place, 'updatedAt' | 'addedAt'>) {
  return new Date(place.updatedAt || place.addedAt).getTime();
}

function getListPlaceSortTime(
  place: Pick<Place, 'updatedAt' | 'addedAt'>,
  list: Pick<PlaceList, 'updatedAt'>,
) {
  return Math.max(getPlaceSortTime(place), new Date(list.updatedAt).getTime());
}

export function buildPlaceFeedCardItems(
  lists: PlaceList[],
  findUserById?: (userId: string) => User | undefined,
) {
  return lists
    .flatMap((list) =>
      list.places.map((place) => ({
        key: `${list.id}:${place.id}`,
        place,
        owner: findUserById?.(list.userId) || null,
        ownerId: list.userId,
        listId: list.id,
        listName: list.name,
        listEmoji: list.emoji,
        listIsPublic: list.isPublic,
        listCoverImage: list.coverImage,
        sortTime: getListPlaceSortTime(place, list),
      }) satisfies PlaceFeedCardItem),
    )
    .sort((left, right) => right.sortTime - left.sortTime);
}
