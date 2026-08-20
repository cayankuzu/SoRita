import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { isCompactAuthLayout } from '@/mobile/app/features/auth/ui/components/authLayout';

export function useAuthLayoutMode() {
  const { fontScale, height, isLandscape, width } = useAppLayout();

  return isCompactAuthLayout({ fontScale, height, isLandscape, width });
}
