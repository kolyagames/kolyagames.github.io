export type ProjectCategory =
  | 'Minecraft & Shaders'
  | 'Desktop & Web'
  | 'Roblox / 3D'
  | 'AI & Automation';

export type CoverId = 'kimstar' | 'vesktop' | 'bodycam' | 'storefront' | 'devsuite';

export interface Project {
  id: CoverId;
  title: string;
  subtitle: string;
  category: ProjectCategory;
  /** Uppercase headline used on the Obsidian gallery cards */
  galleryLines: [string, string];
}

export const CATEGORIES: ('All' | ProjectCategory)[] = [
  'All',
  'Minecraft & Shaders',
  'Desktop & Web',
  'Roblox / 3D',
  'AI & Automation',
];

export const projects: Project[] = [
  {
    id: 'kimstar',
    title: 'Kimstar',
    subtitle: 'Minecraft & Shaders — Custom Client, HUD, Hit Bubbles & GLSL Shaders',
    category: 'Minecraft & Shaders',
    galleryLines: ['KIMSTAR', 'CLIENT'],
  },
  {
    id: 'vesktop',
    title: 'Better Vesktop',
    subtitle: 'Desktop & Web — Open-Source Unified Vesktop & BetterDiscord Client',
    category: 'Desktop & Web',
    galleryLines: ['BETTER', 'VESKTOP'],
  },
  {
    id: 'bodycam',
    title: 'Tactical Bodycam FPS',
    subtitle: 'Roblox / 3D — Photorealistic Luau Tactical Shooter & PBR Terrain',
    category: 'Roblox / 3D',
    galleryLines: ['BODYCAM', 'FPS'],
  },
  {
    id: 'storefront',
    title: 'AI Storefront Automation',
    subtitle: 'AI & Automation — FunPay Cardinal + Claude API Autonomous System',
    category: 'AI & Automation',
    galleryLines: ['AI', 'AUTOMATION'],
  },
  {
    id: 'devsuite',
    title: 'Open-Source Dev Suite',
    subtitle: 'Desktop & Web — nickwatch-bot, corsa-mess & RepoCheatMenu',
    category: 'Desktop & Web',
    galleryLines: ['OPEN-SOURCE', 'DEV SUITE'],
  },
];
