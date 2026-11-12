import NumberFlow, { type NumberFlowProps } from "@number-flow/react";

const transformTiming = { duration: 350, easing: "cubic-bezier(0.2, 0, 0, 1)" };
const opacityTiming = { duration: 150, easing: "ease-out" };

export function AnimatedNumber(props: NumberFlowProps) {
  return <NumberFlow locales="en-US" transformTiming={transformTiming} opacityTiming={opacityTiming} {...props} />;
}
