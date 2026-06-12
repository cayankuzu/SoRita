export type PublicProfileRow = {
  id: string;
  name: string;
  username: string;
  is_public_account: boolean;
  bio: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  interests: string[] | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = PublicProfileRow & {
  email: string;
};

export type ListRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type ListLikeRow = {
  list_id: string;
  user_id: string;
  created_at: string;
};

export type ListReportRow = {
  id: string;
  list_id: string;
  reporter_user_id: string;
  reason: string;
  created_at: string;
};

export type ListPlaceLikeRow = {
  list_place_id: string;
  user_id: string;
  created_at: string;
};

export type ListPlaceReportRow = {
  id: string;
  list_place_id: string;
  reporter_user_id: string;
  reason: string;
  created_at: string;
};

export type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type FollowRequestRow = {
  id: string;
  requester_id: string;
  target_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
};

export type UserBlockRow = {
  blocker_user_id: string;
  blocked_user_id: string;
  created_at: string;
};

export type UserReportRow = {
  id: string;
  reporter_user_id: string;
  target_user_id: string;
  reason: string;
  created_at: string;
};

export type ListPlaceRow = {
  id: string;
  list_id: string;
  created_by: string | null;
  name: string;
  title: string | null;
  lat: number;
  lng: number;
  address: string | null;
  notes: string | null;
  rating: number | null;
  category: string | null;
  categories: string[] | null;
  student_discount: boolean;
  price_range: number | null;
  price_min: number | null;
  price_max: number | null;
  best_time: string | null;
  best_times: string[] | null;
  atmosphere: string[] | null;
  special_features: string[] | null;
  added_at: string;
  updated_at: string;
};

export type ListPlacePhotoRow = {
  id: string;
  list_place_id: string;
  url: string;
  sort_order: number;
  created_at: string;
};

export type ListPlaceCommentRow = {
  id: string;
  list_place_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

export type ListPlaceCommentLikeRow = {
  comment_id: string;
  user_id: string;
  created_at: string;
};

export type ListPlaceCommentReportRow = {
  id: string;
  comment_id: string;
  reporter_user_id: string;
  reason: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type:
    | 'like'
    | 'follow'
    | 'follow_request'
    | 'comment'
    | 'place_added'
    | 'list_liked'
    | 'comment_like'
    | 'comment_reply';
  message: string;
  list_id: string | null;
  list_place_id: string | null;
  follow_request_id: string | null;
  read: boolean;
  created_at: string;
};
