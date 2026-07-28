import {
  Heart, Wrench, Brain, Target, Smile, Star, HandHeart, Sprout,
  BookOpen, Zap, Shield, Sun, Flower2, Compass, Feather, Lightbulb,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  heart: Heart,
  wrench: Wrench,
  brain: Brain,
  target: Target,
  smile: Smile,
  star: Star,
  'hand-heart': HandHeart,
  sprout: Sprout,
  'book-open': BookOpen,
  zap: Zap,
  shield: Shield,
  sun: Sun,
  'flower-2': Flower2,
  compass: Compass,
  feather: Feather,
  lightbulb: Lightbulb,
};

export const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'heart', label: 'Heart' },
  { value: 'wrench', label: 'Wrench' },
  { value: 'brain', label: 'Brain' },
  { value: 'target', label: 'Target' },
  { value: 'smile', label: 'Smile' },
  { value: 'star', label: 'Star' },
  { value: 'hand-heart', label: 'Hand Heart' },
  { value: 'sprout', label: 'Sprout' },
  { value: 'book-open', label: 'Book' },
  { value: 'zap', label: 'Bolt' },
  { value: 'shield', label: 'Shield' },
  { value: 'sun', label: 'Sun' },
  { value: 'flower-2', label: 'Flower' },
  { value: 'compass', label: 'Compass' },
  { value: 'feather', label: 'Feather' },
  { value: 'lightbulb', label: 'Lightbulb' },
];

export const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'var(--coral)', label: 'Coral' },
  { value: 'var(--sky)', label: 'Sky' },
  { value: 'var(--sage)', label: 'Sage' },
  { value: 'var(--amber)', label: 'Amber' },
  { value: 'var(--terracotta)', label: 'Terracotta' },
  { value: 'var(--sage-deep)', label: 'Deep Sage' },
];

export function renderDomainIcon(iconName: string, size: number = 16) {
  const Icon = ICON_MAP[iconName] ?? Heart;
  return <Icon size={size} />;
}
