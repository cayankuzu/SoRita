export type FeedActionLiker = {
  id: string;
  name: string;
  username: string;
  profilePhoto?: string;
  likedAt?: string;
};

export type FeedActionComment = {
  id: string;
  userId: string;
  userName: string;
  username?: string;
  userProfilePhoto?: string;
  content: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  likes?: number;
  liked?: boolean;
  likers?: FeedActionLiker[];
  replies?: FeedActionComment[];
  canEdit?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
};

export type FeedActionLocation = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
};
