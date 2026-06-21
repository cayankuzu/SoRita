type ModalSafeAreaPaddingOptions = {
  topInset: number;
  bottomInset: number;
  topSpacing?: number;
  bottomSpacing?: number;
  minTopPadding?: number;
  minBottomPadding?: number;
};

export function getModalSafeAreaPadding({
  topInset,
  bottomInset,
  topSpacing = 16,
  bottomSpacing = 16,
  minTopPadding = topSpacing,
  minBottomPadding = bottomSpacing,
}: ModalSafeAreaPaddingOptions) {
  return {
    paddingTop: Math.max(topInset + topSpacing, minTopPadding),
    paddingBottom: Math.max(bottomInset + bottomSpacing, minBottomPadding),
  };
}
