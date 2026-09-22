// react-native-svg ships Flow-typed sources that Node cannot parse, so tests
// render each SVG primitive as a plain host element carrying its props.
import React from 'react';

function primitive(name: string) {
  const Component = (props: Record<string, unknown>) => React.createElement(name, props);
  Component.displayName = name;
  return Component;
}

export const Svg = primitive('Svg');
export const Circle = primitive('Circle');
export const ClipPath = primitive('ClipPath');
export const Defs = primitive('Defs');
export const G = primitive('G');
export const Line = primitive('Line');
export const LinearGradient = primitive('LinearGradient');
export const Path = primitive('Path');
export const RadialGradient = primitive('RadialGradient');
export const Rect = primitive('Rect');
export const Stop = primitive('Stop');

export default Svg;
