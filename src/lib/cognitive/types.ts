import { ConceptDiff, ConceptDiffType } from '$lib/stores/conceptMesh';
/**
 * Centralized type definitions for the cognitive system
 * This breaks circular dependencies by providing a single source of truth
 */

// ============================================
// Core Loop Types
// ============================================

export interface LoopRecord {
  // Core identification
  id: string;
  prompt: string;
  
  // Execution trace
  glyphPath: string[];
  phaseTrace: number[];
  coherenceTrace: number[];
  contradictionTrace: number[];
  
  // Closure state
  returnGlyph?: string;
  closed: boolean;
  scarFlag: boolean;
  timestamp: Date;
  processingTime: number;
  
  // Phase 2: Compression & Memory
  coreGlyphs?: string[];
  cInfinity?: number;
  digest?: string;
  reentryCount?: number;
  memoryEchoFlag?: boolean;
  
  // Braid topology
  crossingRefs?: string[];
  braidPosition?: {
    x: number;
    y: number;
    z: number;
  };
  
  // Integration metadata
  metadata?: {
    createdByPersona?: string;
    scriptId?: string;
    conceptFootprint?: string[];
    phaseGateHits?: string[];
    contradictionPeaks?: number[];
    coherenceGains?: Array<{
      glyphIndex: number;
      deltaC: number;
    }>;
    [key: string]: any;
  };
  
  // Additional fields for enhanced loop record
  entries?: ConceptDiffState[];
  createdAt?: number;
  closedAt?: number;
  weight?: number;
  scarred?: boolean;
  compressed?: boolean;
  crossings?: LoopCrossing[];
}

export interface LoopCrossing {
  id: string;
  sourceLoopId: string;
  targetLoopId: string;
  type: 'reentry' | 'echo' | 'resonance' | 'paradox';
  glyph: string;
  timestamp: number;
}

// ============================================
// Cognitive State Types
// ============================================

}

export interface CognitiveState extends ConceptDiffState {
  conceptDiffState?: ConceptDiffState;
  loopDepth: number;
  scars: Set<string>;
  maxLoopDepth: number;
  conceptHistory: ConceptDiffState[];
  contradictions: any[];
  phase: number;
}

// ============================================
// Braid Memory Types
// ============================================

export interface BraidMemory {
  loops: Map<string, LoopRecord>;
  digestMap: Map<string, string[]>;
  activeLoop: LoopRecord | null;
  stats: BraidMemoryStats;
  
  // Methods
  recordLoop(loop: LoopRecord): void;
  getLoopById(id: string): LoopRecord | undefined;
  getLoopsByDigest(digest: string): LoopRecord[];
  closeActiveLoop(returnGlyph: string, scarFlag: boolean): void;
  compressLoop(loopId: string): void;
  createCrossing(source: string, target: string, type: string, glyph: string): void;
  getStats(): BraidMemoryStats;
  exportBraid(): any;
}

export interface BraidMemoryStats {
  totalLoops: number;
  activeLoops: number;
  closedLoops: number;
  scarredLoops: number;
  crossings: number;
  memoryEchoes: number;
  compressionRatio: number;
}

// ============================================
// Memory Metrics Types
// ============================================

export enum MemoryHealth {
  EXCELLENT = 'Excellent',
  GOOD = 'Good',
  FAIR = 'Fair',
  UNSTABLE = 'Unstable',
  CRITICAL = 'Critical',
  COLLAPSING = 'Collapsing'
}

export interface MemoryMetrics {
  rhoM: number;                  // Loop density
  kappaI: number;                // Information curvature
  thetaDelta: number;            // Phase transition rate
  scarRatio: number;
  memoryPressure: number;
  godelianCollapseRisk: boolean;
  
  // Extended metrics
  loopDensity?: number;
  curvature?: number;
  memoryHealth?: MemoryHealth;
  godelianRisk?: boolean;
  compressionPlateau?: boolean;
  recursiveBurstRisk?: number;
  condorcetCycleCount?: number;
  totalLoops?: number;
  closedLoops?: number;
  scarCount?: number;
  unresolvedLoops?: number;
  activeConceptNodes?: number;
}

export interface MemoryMetricsMonitor {
  getMetrics(): MemoryMetrics;
  getHealth(): MemoryHealth;
  getHistory(): any;
  onUpdate(callback: (metrics: MemoryMetrics, health: MemoryHealth) => void): void;
}

// ============================================
// Paradox Analysis Types
// ============================================

export interface ParadoxEvent {
  id: string;
  timestamp: number;
  associatorResult: AssociatorResult;
  cognitiveState: ConceptDiffState | CognitiveState;
  resolved: boolean;
}

export interface AssociatorResult {
  type: 'left' | 'right' | 'jacobi' | 'moufang' | 'valid';
  expression: string;
  operations: Operation[];
}

export interface Operation {
  left: string;
  right: string;
  result: string;
}

export interface ParadoxAnalyzer {
  measureAssociator(opX: string, opY: string, opZ: string): AssociatorResult;
  getStats(): any;
  getUnresolvedParadoxes(): ParadoxEvent[];
  onParadox(callback: (event: ParadoxEvent) => void): void;
}

// ============================================
// Closure & Engine Types
// ============================================

export interface ClosureResult {
  canClose: boolean;
  reason?: string;
  suggestedAction?: string;
  metrics?: {
    coherence: number;
    contradiction: number;
    volatility: number;
  };
}

export interface FeedbackOptions {
  strengthenConcepts?: string[];
  weakenConcepts?: string[];
  adjustPhase?: number;
  healScars?: boolean;
}

export interface CognitiveEngineConfig {
  enableBraidMemory?: boolean;
  enableParadoxAnalysis?: boolean;
  enableMemoryMetrics?: boolean;
  maxLoopDepth?: number;
  autoHealScars?: boolean;
  compressionEnabled?: boolean;
  phase?: number;
}

export interface CognitiveEngine {
  processContext(context: any): Promise<any>;
  getDiagnostics(): any;
}

export interface ClosureGuard {
  evaluateClosure(): ClosureResult;
  applyFeedback(options: FeedbackOptions): void;
}

export interface PhaseController {
  getCurrentPhase(): number;
  setPhase(phase: number): void;
}

export interface ContradictionMonitor {
  checkContradiction(): boolean;
  getContradictionLevel(): number;
}

// ============================================
// Constants
// ============================================

export const CognitiveThresholds = {
  PI_LOW: 0.2,
  PI_MEDIUM: 0.5,
  PI_HIGH: 0.8,
  PI_CRITICAL: 1.0,
  SIGMA_STABLE: 0.1,
  SIGMA_ALERT: 0.3,
  SIGMA_CRITICAL: 0.6,
  COHERENCE_MIN: 0.4,
  COHERENCE_GOOD: 0.7,
  COHERENCE_EXCELLENT: 0.9,
  GATE_WIDTH_DEFAULT: 0.5,
  GATE_ALIGNMENT_TIMEOUT: 10,
  DENSITY_MIN: 0.3,
  CURVATURE_MAX: 0.8
} as const;

export const NoveltyGlyphs = {
  STAR: '⟡',
  CROSS: '☩',
  SPIRAL: '⟆',
  DIAMOND: '♢',
  CIRCLE: '⊙'
} as const;

export type NoveltyGlyph = keyof typeof NoveltyGlyphs;

export const CompressionConfig = {
  maxLoopSize: 100,
  compressionRatio: 0.3,
  preserveKeyframes: true,
  keepCrossings: true
} as const;

// ============================================
// Utility Functions
// ============================================

export function calculateLoopWeight(loop: LoopRecord): number {
  const baseWeight = 1.0;
  const scarBonus = loop.scarFlag ? 2.0 : 1.0;
  const reentryBonus = Math.log2((loop.reentryCount || 0) + 1);
  const coherenceBonus = loop.cInfinity || 0;
  
  return baseWeight * scarBonus + reentryBonus + coherenceBonus;
}

export function classifyCrossingType(
  sourceLoop: LoopRecord,
  targetLoop: LoopRecord
): 'reentry' | 'echo' | 'resonance' | 'paradox' {
  if (sourceLoop.digest === targetLoop.digest) return 'echo';
  if (sourceLoop.scarFlag && targetLoop.scarFlag) return 'paradox';
  if (sourceLoop.cInfinity && targetLoop.cInfinity && 
      Math.abs(sourceLoop.cInfinity - targetLoop.cInfinity) < 0.1) return 'resonance';
  return 'reentry';
}

export function selectNoveltyGlyph(reason: string): string {
  const glyphMap: Record<string, string> = {
    'high_coherence': NoveltyGlyphs.STAR,
    'paradox': NoveltyGlyphs.CROSS,
    'loop': NoveltyGlyphs.SPIRAL,
    'breakthrough': NoveltyGlyphs.DIAMOND,
    'default': NoveltyGlyphs.CIRCLE
  };
  
  return glyphMap[reason] || glyphMap.default;
}





export type ConceptDiffState = ConceptDiff;
