import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MapPin } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useListDetailScreenState } from '@/mobile/app/features/lists/application/useListDetailScreenState';
import { ListDetailHeader } from '@/mobile/app/features/lists/ui/components/ListDetailHeader';
import { ListDetailPlacesSection } from '@/mobile/app/features/lists/ui/components/ListDetailPlacesSection';
import { listDetailScreenStyles as styles } from '@/mobile/app/features/lists/ui/components/listDetailScreenStyles';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

export function ListDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const [deletePlaceId, setDeletePlaceId] = useState<string | null>(null);
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const listId = route.params?.listId as string;
  const placeId = route.params?.placeId as string | undefined;
  const {
    canReportList,
    deletePlace,
    displayPlaces,
    isOwner,
    list,
    mapPlaces,
    onRefresh,
    owner,
    refreshing,
    reportList,
  } = useListDetailScreenState({
    listId,
    user,
  });

  useEffect(() => {
    setHighlightedPlaceId(placeId ?? null);
  }, [placeId, listId]);

  const highlightedIndex = useMemo(() => {
    if (!list || !highlightedPlaceId) {
      return null;
    }

    const index = displayPlaces.findIndex((place) => place.id === highlightedPlaceId);
    return index >= 0 ? index : null;
  }, [displayPlaces, highlightedPlaceId, list]);

  const requestDeletePlace = (placeIdToDelete: string) => {
    setDeletePlaceId(placeIdToDelete);
  };

  const confirmDeletePlace = async () => {
    if (!list || !deletePlaceId) {
      return;
    }

    await deletePlace(deletePlaceId);
    setDeletePlaceId(null);
    showToast(tr.listDetail.deletePlaceSuccess, 'success');
  };

  const handleReportList = async () => {
    if (!list || !user || !reportReason) {
      return;
    }

    try {
      await reportList(reportReason);
      setReportVisible(false);
      setReportReason('');
      showToast(tr.cards.reportSent, 'success');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        showToast('Bu listeyi zaten bildirdin', 'error');
        return;
      }

      showToast(error instanceof Error ? error.message : 'Liste bildirilemedi', 'error');
    }
  };

  if (!list) {
    return (
      <Screen>
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={34} />}
          title={tr.listDetail.notFoundTitle}
          description={tr.listDetail.notFoundDescription}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.content}>
        <ListDetailHeader
          list={list}
          canReportList={canReportList}
          onBack={() => navigation.goBack()}
          onOpenCover={() => list.coverImage && setLightboxUri(list.coverImage)}
          onReport={() => setReportVisible(true)}
        />
        <ListDetailPlacesSection
          list={list}
          displayPlaces={displayPlaces}
          mapPlaces={mapPlaces}
          highlightedIndex={highlightedIndex}
          highlightedPlaceId={highlightedPlaceId}
          owner={owner}
          isOwner={isOwner}
          onHighlightPlace={setHighlightedPlaceId}
          onOpenOwnerProfile={() =>
            owner && openStackScreen(navigation, 'UserProfile', { userId: owner.id })
          }
          onRequestDeletePlace={requestDeletePlace}
        />
      </View>

      <ConfirmActionModal
        visible={Boolean(deletePlaceId)}
        title={tr.listDetail.deletePlaceTitle}
        description={tr.listDetail.deletePlaceDescription}
        confirmLabel={tr.common.delete}
        confirmVariant="danger"
        onClose={() => setDeletePlaceId(null)}
        onConfirm={() => {
          void confirmDeletePlace();
        }}
      />

      <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />
      <ReportActionSheet
        visible={reportVisible}
        title="Listeyi bildir"
        description="Bu listeyi neden bildirmek istedigini sec."
        reportReason={reportReason}
        onReportReasonChange={setReportReason}
        onClose={() => {
          setReportVisible(false);
          setReportReason('');
        }}
        onSubmit={() => {
          void handleReportList();
        }}
      />
    </Screen>
  );
}
