import { spacing } from '@/design-system';

/**
 * Space between cards, built the way FlashList v2 allows. Its content container only accepts
 * padding and background, and `ItemSeparatorComponent` draws a vertical separator under a cell,
 * which in a grid would leave the column gap empty. So every cell pads itself by half the gap
 * (`GRID_CELL_PADDING` on each side = `spacing.sm` between neighbours) and the container pads
 * by the rest of the screen margin, which keeps the cards aligned with the 16 dp margin of the
 * header text. The skeleton uses the same numbers so nothing moves when the data arrives.
 */
export const GRID_CELL_PADDING = spacing.xs;

/** Horizontal padding of the list container: screen margin minus the padding of the cell. */
export const GRID_EDGE_PADDING = spacing.md - GRID_CELL_PADDING;
