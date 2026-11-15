/** Shared by HTML rows, flower shaders and the butterfly guide; no React frames. */
export const gardenState = {
  /** Centers of the four featured flower cores, in world coordinates. */
  anchors: new Float32Array(12),
  /** The same centers in CSS pixels, measured from the viewport's top left. */
  screenAnchors: new Float32Array(8),
  /** Index in handmadeProjects, or -1 when neither hovered nor focused. */
  active: -1,
};
