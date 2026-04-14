export const notificationUiConfig = {
  title: 'Bildirimler',
  newCount: (count: number) => `${count} yeni bildirim`,
  categories: {
    all: 'Tümü',
    likes: 'Beğeniler',
    follows: 'Takip',
    comments: 'Yorumlar',
    places: 'Mekanlar',
  },
  emptyTitle: 'Bildirim yok',
  emptyDescription: 'Bu kategoride şu an içerik bulunmuyor.',
};
