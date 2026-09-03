/**
 * How much proctoring actually runs.
 *
 *   mock   (default) - camera and microphone are switched on and the candidate
 *                      can see they are live, but no analysis is performed.
 *                      Nothing is inspected, recorded, or uploaded.
 *   detect            - additionally runs on-device object detection, flagging
 *                       phones and extra people for a human to review.
 *
 * Mock is the default deliberately. The detector is a deterrent with a real
 * false-positive rate, and running it by accident on drive day would put
 * unexplained flags on honest candidates.
 *
 * Set VITE_PROCTOR_MODE=detect in apps/portal/.env to turn detection on.
 */
export const PROCTOR_MODE = import.meta.env.VITE_PROCTOR_MODE === "detect" ? "detect" : "mock"

export const isDetectionEnabled = PROCTOR_MODE === "detect"
