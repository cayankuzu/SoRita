import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';

export type PlaceListMembership = {
  listId: string;
  listName: string;
  listEmoji?: string;
  listIsPublic: boolean;
  listCoverImage?: string;
  updatedAt: string;
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
  memberships: PlaceListMembership[];
  sortTime: number;
};

function getPlaceSortTime(place: Pick<Place, 'updatedAt' | 'addedAt'>) {
  return new Date(place.updatedAt || place.addedAt).getTime();
}

function normalizePlaceIdentityValue(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function buildMembershipKey(ownerId: string, place: Pick<Place, 'name' | 'lat' | 'lng'>) {
  return [
    ownerId,
    normalizePlaceIdentityValue(place.name),
    place.lat.toFixed(5),
    place.lng.toFixed(5),
  ].join(':');
}

export function buildPlaceFeedCardItems(
  lists: PlaceList[],
  findUserById?: (userId: string) => User | undefined,
) {
  const flattenedItems = lists
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
        memberships: [],
        sortTime: getPlaceSortTime(place),
      }) satisfies PlaceFeedCardItem),
    )
    .sort((left, right) => right.sortTime - left.sortTime);

  const membershipsByPlaceKey = new Map<string, PlaceListMembership[]>();

  for (const list of lists) {
    for (const place of list.places) {
      const membershipKey = buildMembershipKey(list.userId, place);
      const memberships = membershipsByPlaceKey.get(membershipKey) || [];

      memberships.push({
        listId: list.id,
        listName: list.name,
        listEmoji: list.emoji,
        listIsPublic: list.isPublic,
        listCoverImage: list.coverImage,
        updatedAt: list.updatedAt,
      });
      membershipsByPlaceKey.set(membershipKey, memberships);
    }
  }

  for (const memberships of membershipsByPlaceKey.values()) {
    memberships.sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }

  return flattenedItems.map((item) => ({
    ...item,
    memberships:
      membershipsByPlaceKey.get(buildMembershipKey(item.ownerId, item.place)) || [],
  }));
}
