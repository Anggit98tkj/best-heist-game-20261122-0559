// The Midnight Heist: shared constants and the three hand-built jobs.
// A job is one building to rob: a tile map, guard patrols and cameras.
// Tiles: # wall  . floor  D dark floor (slows the alarm)  C crate (solid, blocks sight)
//        L loot  E exit   P crew start
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const W = COLS * TILE;
export const H = ROWS * TILE;
export const STEP = 1 / 60;
export const BEST_KEY = 'midnight-heist-best';

export const CONE_RANGE = 185;
export const CONE_HALF = 0.62;
export const CAMERA_RANGE = 215;
export const CAMERA_HALF = 0.46;
export const NOISE_RADIUS = 110;
export const LIVES = 3;
export const LOOT_POINTS = 500;
export const EMP_COST = 150;
export const DECOY_COST = 100;

export const LEVELS = [
  {
    name: '1 - The Harlow Gallery',
    lootName: 'paintings',
    map: [
      '########################',
      '#P...#......#......L...#',
      '#....#..C...#..D.......#',
      '#.##.#......#.....##...#',
      '#....#..##..#.###......#',
      '#..D.....#..#...#..C...#',
      '#.####...#..#...#......#',
      '#....#...#.....D#......#',
      '#..C.#.###.####.#.##...#',
      '#....#.....#....#......#',
      '#.##..##...#..C.#..#...#',
      '#....D......#....#.....#',
      '#..##...##..#..##......#',
      '#..L....C...D...L..E...#',
      '########################',
    ],
    guards: [
      { path: [[14, 1], [20, 1], [20, 2], [14, 2]], speed: 60 },
      { path: [[18, 9], [21, 9], [21, 12], [18, 12]], speed: 60 },
    ],
    cameras: [
      { col: 12, row: 7, base: Math.PI / 2, sweep: 0.9, speed: 0.45 },
    ],
  },
  {
    name: '2 - Meridian Bank',
    lootName: 'gold bars',
    map: [
      '########################',
      '#P....#....D.....#..L..#',
      '#.....#..C....#..#.....#',
      '#.##..#......#..#..#...#',
      '#.....##..#..#..#..#...#',
      '#..D......#..#.....#...#',
      '#.#####...#..#..C..#...#',
      '#.....#...#.....#..#...#',
      '#.C...#.###.##..#......#',
      '#.....#.....#...#..#...#',
      '#.##..#..D..#...#..#...#',
      '#....#....#...#....#...#',
      '#..#.#..##.#..#..##.#..#',
      '#..L...C...D...#..L.E..#',
      '########################',
    ],
    guards: [
      { path: [[7, 1], [12, 1], [12, 3], [7, 3]], speed: 68 },
      { path: [[20, 2], [22, 2], [22, 6], [20, 6]], speed: 68 },
      { path: [[7, 9], [11, 9], [11, 10], [7, 10]], speed: 64 },
    ],
    cameras: [
      { col: 11, row: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.55 },
      { col: 20, row: 8, base: Math.PI, sweep: 0.8, speed: 0.5 },
    ],
  },
  {
    name: '3 - The Gilded Vault',
    lootName: 'diamonds',
    map: [
      '########################',
      '#P..#...D....#.....#.L.#',
      '#...#........#..C..#...#',
      '#.###..##....#.....#.#.#',
      '#.....#......#.###.#.#.#',
      '#..C..#..D...#...#.#.#.#',
      '#.....#......#...#.#...#',
      '#.####.##.####...#.#.#.#',
      '#....#....#......#.#...#',
      '#.D..#.C..#..##..#.#.C.#',
      '#....#....#......#...#.#',
      '#.##.#.####.##...#.##..#',
      '#....#.....D..#..#....L#',
      '#..L.....C....#..#....E#',
      '########################',
    ],
    guards: [
      { path: [[9, 2], [12, 2], [12, 5], [9, 5]], speed: 76 },
      { path: [[18, 1], [18, 6]], speed: 76 },
      { path: [[6, 8], [9, 8], [9, 10], [6, 10]], speed: 72 },
      { path: [[18, 12], [22, 12], [22, 13], [18, 13]], speed: 72 },
    ],
    cameras: [
      { col: 11, row: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.6 },
      { col: 11, row: 8, base: -Math.PI / 2, sweep: 0.9, speed: 0.5 },
      { col: 20, row: 12, base: Math.PI, sweep: 0.8, speed: 0.55 },
    ],
  },
];
