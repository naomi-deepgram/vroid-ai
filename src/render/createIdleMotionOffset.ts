/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

const breathAmplitude = 0.02;
const breathPeriodMs = 4000;
const swayAmplitudeRadians = 0.03;
const swayPeriodMs = 6000;
const tau = 2 * Math.PI;

/**
 * A small, continuous idle motion offset to apply to the VRM rig.
 */
interface IdleMotionOffset {
  readonly chestScale:      number;
  readonly headTiltRadians: number;
}

/**
 * Produces a small, continuous idle motion offset from elapsed time so
 * an otherwise-static VRM avatar reads as alive between lines of
 * dialogue. Both signals are pure sine waves on independent periods so
 * they never fall into a repeating combined cycle a viewer would
 * consciously notice.
 * @param elapsedMs - Milliseconds elapsed since rendering began.
 * @returns The chest scale and head tilt offsets to apply this frame.
 */
const createIdleMotionOffset = (elapsedMs: number): IdleMotionOffset => {
  const breathCycles = elapsedMs / breathPeriodMs;
  const breathPhase = breathCycles * tau;
  const swayCycles = elapsedMs / swayPeriodMs;
  const swayPhase = swayCycles * tau;

  const breathOffset = Math.sin(breathPhase) * breathAmplitude;
  const swayOffset = Math.sin(swayPhase) * swayAmplitudeRadians;

  return {
    chestScale:      1 + breathOffset,
    headTiltRadians: swayOffset,
  };
};

export { createIdleMotionOffset, type IdleMotionOffset };
