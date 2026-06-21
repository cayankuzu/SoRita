export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  isPublicAccount?: boolean;
  profilePhoto?: string;
  coverPhoto?: string;
  bio?: string;
  interests?: string[];
  following?: string[];
  followers?: string[];
  pendingFollowRequestsSent?: string[];
  pendingFollowRequestsReceived?: string[];
  blockedUsers?: string[];
  blockedByUsers?: string[];
}

export interface PlaceComment {
  id: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  isPending?: boolean;
  likes?: number;
  likedBy?: string[];
  likeDetails?: Array<{
    userId: string;
    createdAt: string;
  }>;
  replies?: PlaceComment[];
  author?: {
    userId: string;
    name: string;
    username: string;
    profilePhoto?: string;
  };
}

export type PlaceMediaType = 'photo' | 'video';

export interface PlaceMedia {
  id?: string;
  url: string;
  type: PlaceMediaType;
  mimeType?: string;
  durationMs?: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileName?: string;
}

export interface Place {
  id: string;
  name: string;
  title?: string;
  lat: number;
  lng: number;
  address?: string;
  notes?: string;
  rating?: number; // 0-5 in 0.5 increments
  category?: string;
  categories?: string[];
  studentDiscount?: boolean;
  priceRange?: number;
  priceMin?: number;
  priceMax?: number;
  bestTime?: string;
  bestTimes?: string[];
  atmosphere?: string[];
  specialFeatures?: string[];
  media?: PlaceMedia[];
  photos?: string[];
  likes?: number;
  likedBy?: string[];
  likeDetails?: Array<{
    userId: string;
    createdAt: string;
  }>;
  comments?: PlaceComment[];
  addedAt: string;
  updatedAt?: string;
  addedBy?: { userId: string; userName: string; userAvatar?: string };
  sourceAttribution?: {
    listId?: string;
    placeId: string;
    placeName?: string;
    userAvatar?: string;
    userId?: string;
    userName: string;
  };
}

export interface PlaceList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  emoji?: string;
  coverImage?: string;
  places: Place[];
  isPublic: boolean;
  likes?: number;
  likedBy?: string[];
  likeDetails?: Array<{
    userId: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type PrivacyType = 'public' | 'private';
