import type { PlaceMedia } from '@/mobile/app/contracts/placeMedia';

export type PlaceEditorDraft = {
  step: number;
  name: string;
  title: string;
  menuUrl: string;
  address: string;
  notes: string;
  selectedCategories: string[];
  rating: number;
  studentFriendly: boolean;
  priceMin: string;
  priceMax: string;
  selectedLists: string[];
  media?: PlaceMedia[];
  photos?: string[];
  bestTimes: string[];
  atmosphere: string[];
  features: string[];
  newListName: string;
  newListDescription: string;
  newListCoverImage: string;
  newListPublic: boolean;
  showNewListForm: boolean;
};
