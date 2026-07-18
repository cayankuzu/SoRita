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
  pendingSync?: boolean;
  likes?: number;
  liked?: boolean;
  likers?: FeedActionLiker[];
  replies?: FeedActionComment[];
  canEdit?: boolean;
  editWindowExpired?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
};

export type FeedActionLocation = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
};
