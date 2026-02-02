import { MAX_POINTS_PER_ITEM } from '../data/constants.js';

export function computeItemPoints(elapsedSeconds) {
  return Math.max(0, MAX_POINTS_PER_ITEM - elapsedSeconds);
}
