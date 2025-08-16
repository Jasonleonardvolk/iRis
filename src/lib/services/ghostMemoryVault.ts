// Ghost Memory Vault adapter for Svelte UI
// This service connects the original GhostMemoryVault to the Svelte frontend
// Now using solitonMemory mesh for persistence instead of databases

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import * as GhostStore from './GhostMemoryVaultAdapter';

// Types matching GhostMemoryVault
export interface GhostMemoryEntry {
  id: string;
  timestamp: Date;
  sessionId: string;
  persona: string;
  eventType: 'emergence' | 'shift' | 'letter' | 'mood' | 'intervention' | 'reflection';
  content: {
    message?: string;
    moodVector?: Record<string, number>;
    reflectionSummary?: string;
    interventionResult?: 'positive' | 'neutral' | 'negative';
  };
  trigger: {
    conceptDiffs: string[];
    phaseMetrics: {
      coherence: number;
      entropy: number;
      drift: number;
      phaseAngle?: number;
      eigenmode?: string;
    };
    userContext: {
      sentiment?: number;
      activity?: string;
      frustrationLevel?: number;
      engagementLevel?: number;
    };
    systemContext: {
      conversationLength: number;
      recentConcepts: string[];
      codeContext?: any;
      errorContext?: any;
    };
  };
  indexing: {
    conceptTags: string[];
    phaseSignature: string;
    emotionalTone: string;
    searchableContent: string;
    memoryWeight: number;
  };
  outcomes?: {
    userResponse?: 'positive' | 'neutral' | 'negative' | 'ignored';
    effectiveness?: number;
    followUpRequired?: boolean;
    learningNote?: string;
  };
}

export interface GhostMoodCurve {
  sessionId: string;
  timePoints: Array<{
    timestamp: Date;
    persona: string;
    dominance: number;
    stability: number;
    moodVector: Record<string, number>;
    phaseAlignment: number;
  }>;
}

export interface ConceptArc {
  id: string;
  conceptIds: string[];
  narrative: string;
  emotionalJourney: Array<{
    stage: string;
    emotion: string;
    intensity: number;
  }>;
  ghostInterventions: string[];
  resolution?: {
    outcome: string;
    learnings: string[];
    futureGuidance: string;
  };
}

// Stores
export const ghostMemories = writable<GhostMemoryEntry[]>([]);
export const ghostMoodCurves = writable<GhostMoodCurve[]>([]);
export const ghostConceptArcs = writable<ConceptArc[]>([]);
export const isGhostVaultConnected = writable(false);

// Event emitters
export function emitGhostEvent(eventType: string, detail: any) {
  if (browser) {
    const event = new CustomEvent(eventType, { detail });
    document.dispatchEvent(event);
  }
}

// Initialize connection to GhostMemoryVault
export async function initializeGhostMemoryConnection() {
  if (!browser) return;
  
  try {
    // Load from mesh through the adapter
    const meshGhosts = await GhostStore.getAllGhosts();
    
    // Convert GhostStore.GhostEvent to GhostMemoryEntry format
    const memories = meshGhosts.map(ghost => ({
      id: ghost.id,
      timestamp: new Date(ghost.createdAt),
      sessionId: ghost.id.split('_')[1] || 'unknown',
      persona: ghost.persona,
      eventType: 'emergence' as const,
      content: {
        message: ghost.intervention,
        interventionResult: ghost.outcome as any
      },
      trigger: {
        conceptDiffs: [],
        phaseMetrics: {
          coherence: ghost.coherence || 0.5,
          entropy: ghost.entropy || 0.5,
          drift: ghost.drift || 0,
          phaseAngle: ghost.phaseTag
        },
        userContext: {},
        systemContext: {
          conversationLength: 0,
          recentConcepts: []
        }
      },
      indexing: {
        conceptTags: [ghost.persona],
        phaseSignature: calculatePhaseSignature({
          coherence: ghost.coherence,
          entropy: ghost.entropy,
          drift: ghost.drift
        }),
        emotionalTone: determineEmotionalTone(ghost.persona, {}),
        searchableContent: `${ghost.persona} ${ghost.intervention || ''}`,
        memoryWeight: 0.6
      },
      outcomes: ghost.outcome ? {
        userResponse: ghost.outcome as any,
        effectiveness: ghost.outcome === 'success' ? 0.8 : 0.4
      } : undefined
    }));
    
    ghostMemories.set(memories);
    isGhostVaultConnected.set(true);
    
    console.log(`👻 Loaded ${memories.length} ghost memories from mesh`);
  } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize ghost memory connection:', error);
    isGhostVaultConnected.set(false);
  
}
  
  // Set up event listeners for new ghost events
  setupEventListeners();
}

// Set up listeners for ghost events
function setupEventListeners() {
  if (!browser) return;
  
  // Listen for ghost emergence
  document.addEventListener('tori-ghost-emergence', ((e: CustomEvent) => {
    recordGhostMemory({
      persona: e.detail.persona,
      sessionId: e.detail.sessionId,
      eventType: 'emergence',
      trigger: e.detail.trigger,
      phaseMetrics: e.detail.phaseMetrics,
      userContext: e.detail.userContext,
      systemContext: e.detail.systemContext
    });
  }) as EventListener);
  
  // Listen for ghost letters
  document.addEventListener('tori-ghost-letter-sent', ((e: CustomEvent) => {
    recordGhostMemory({
      persona: e.detail.persona,
      sessionId: e.detail.sessionId,
      eventType: 'letter',
      content: { message: e.detail.letterContent },
      trigger: e.detail.trigger,
      phaseMetrics: e.detail.phaseMetrics,
      conceptArc: e.detail.conceptArc
    });
  }) as EventListener);
  
  // Listen for mood updates
  document.addEventListener('tori-ghost-mood-update', ((e: CustomEvent) => {
    updateMoodCurve(e.detail);
  }) as EventListener);
}

// Record a new ghost memory
export async function recordGhostMemory(data: any) {
  const entry: GhostMemoryEntry = {
    id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    sessionId: data.sessionId,
    persona: data.persona,
    eventType: data.eventType,
    content: data.content || {},
    trigger: {
      conceptDiffs: data.trigger?.conceptDiffs || data.conceptArc || [],
      phaseMetrics: data.phaseMetrics || {
        coherence: 0.5,
        entropy: 0.5,
        drift: 0
      },
      userContext: data.userContext || {},
      systemContext: data.systemContext || {
        conversationLength: 0,
        recentConcepts: []
      }
    },
    indexing: {
      conceptTags: extractConceptTags(data),
      phaseSignature: calculatePhaseSignature(data.phaseMetrics),
      emotionalTone: determineEmotionalTone(data.persona, data.userContext),
      searchableContent: generateSearchableContent(data),
      memoryWeight: calculateMemoryWeight(data)
    }
  };
  
  // Add to store
  ghostMemories.update(memories => [...memories, entry]);
  
  // Persist to mesh through adapter
  try {
    const ghostEvent: GhostStore.GhostEvent = {
      id: entry.id,
      persona: entry.persona,
      phaseTag: entry.trigger.phaseMetrics.phaseAngle,
      coherence: entry.trigger.phaseMetrics.coherence,
      entropy: entry.trigger.phaseMetrics.entropy,
      drift: entry.trigger.phaseMetrics.drift,
      moodCurve: data.moodCurve,
      conceptArc: data.conceptArc,
      intervention: entry.content.message,
      outcome: entry.outcomes?.userResponse || 'neutral',
      createdAt: entry.timestamp.toISOString()
    };
    
    await GhostStore.recordGhost(ghostEvent);
    emitGhostEvent('ghost:new', ghostEvent);
  } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to persist ghost memory to mesh:', error);
  
}
  
  console.log(`👻 Recorded ${data.persona} ${data.eventType} event`);
}

// Update mood curve
export function updateMoodCurve(data: {
  persona: string;
  sessionId: string;
  moodVector: Record<string, number>;
  phaseAlignment: number;
  stability: number;
}) {
  ghostMoodCurves.update(curves => {
    const existing = curves.find(c => c.sessionId === data.sessionId);
    
    const point = {
      timestamp: new Date(),
      persona: data.persona,
      dominance: calculatePersonaDominance(data.persona, data.moodVector),
      stability: data.stability,
      moodVector: data.moodVector,
      phaseAlignment: data.phaseAlignment
    };
    
    if (existing) {
      existing.timePoints.push(point);
      // Keep only last 100 points
      if (existing.timePoints.length > 100) {
        existing.timePoints = existing.timePoints.slice(-100);
      }
      return curves;
    } else {
      return [...curves, {
        sessionId: data.sessionId,
        timePoints: [point]
      }];
    }
  });
}

// Record intervention outcome
export async function recordInterventionOutcome(
  memoryId: string,
  outcome: {
    userResponse: 'positive' | 'neutral' | 'negative' | 'ignored';
    effectiveness?: number;
    learningNote?: string;
  }
) {
  ghostMemories.update(memories => {
    const memory = memories.find(m => m.id === memoryId);
    if (memory) {
      memory.outcomes = {
        ...memory.outcomes,
        ...outcome,
        followUpRequired: outcome.userResponse === 'negative' || (outcome.effectiveness && outcome.effectiveness < 0.5)
      };
    }
    return memories;
  });
}

// Search ghost memories
export async function searchGhostMemories(query: {
  persona?: string;
  phaseSignature?: string;
  conceptIds?: string[];
  emotionalTone?: string;
  timeRange?: { start: Date; end: Date };
  minWeight?: number;
}): Promise<GhostMemoryEntry[]> {
  // Use the adapter to query
  if (query.persona || query.timeRange) {
    const meshQuery: GhostStore.GhostQuery = {
      persona: query.persona,
      since: query.timeRange?.start
    };
    
    const ghostEvents = await GhostStore.filterGhosts(meshQuery);
    
    // Convert back to GhostMemoryEntry format
    return ghostEvents.map(ghost => ({
      id: ghost.id,
      timestamp: new Date(ghost.createdAt),
      sessionId: ghost.id.split('_')[1] || 'unknown',
      persona: ghost.persona,
      eventType: 'emergence' as const,
      content: {
        message: ghost.intervention,
        interventionResult: ghost.outcome as any
      },
      trigger: {
        conceptDiffs: [],
        phaseMetrics: {
          coherence: ghost.coherence || 0.5,
          entropy: ghost.entropy || 0.5,
          drift: ghost.drift || 0,
          phaseAngle: ghost.phaseTag
        },
        userContext: {},
        systemContext: {
          conversationLength: 0,
          recentConcepts: []
        }
      },
      indexing: {
        conceptTags: [ghost.persona],
        phaseSignature: calculatePhaseSignature({
          coherence: ghost.coherence,
          entropy: ghost.entropy,
          drift: ghost.drift
        }),
        emotionalTone: determineEmotionalTone(ghost.persona, {}),
        searchableContent: `${ghost.persona} ${ghost.intervention || ''}`,
        memoryWeight: 0.6
      },
      outcomes: ghost.outcome ? {
        userResponse: ghost.outcome as any,
        effectiveness: ghost.outcome === 'success' ? 0.8 : 0.4
      } : undefined
    }));
  }
  
  // For other query types, use the local store
  const memories = get(ghostMemories);
  let results = memories;
  
  if (query.phaseSignature) {
    results = results.filter(m => m.indexing.phaseSignature === query.phaseSignature);
  }
  
  if (query.conceptIds && query.conceptIds.length > 0) {
    results = results.filter(m =>
      query.conceptIds!.some(concept => m.indexing.conceptTags.includes(concept))
    );
  }
  
  if (query.emotionalTone) {
    results = results.filter(m => m.indexing.emotionalTone === query.emotionalTone);
  }
  
  if (query.minWeight !== undefined) {
    results = results.filter(m => m.indexing.memoryWeight >= query.minWeight!);
  }
  
  return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Generate ghost reflection
export function generateGhostReflection(sessionId: string, persona?: string) {
  const memories = get(ghostMemories);
  const sessionMemories = memories
    .filter(m => m.sessionId === sessionId && (!persona || m.persona === persona))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  if (sessionMemories.length === 0) {
    return {
      summary: "No ghost interactions recorded for this session.",
      insights: [],
      patterns: [],
      recommendations: []
    };
  }
  
  return {
    summary: generateReflectionSummary(sessionMemories),
    insights: extractInsights(sessionMemories),
    patterns: identifyPatterns(sessionMemories),
    recommendations: generateRecommendations(sessionMemories)
  };
}

// Get all ghosts - passthrough to adapter
export const getAll = GhostStore.getAllGhosts;

// Helper functions
function extractConceptTags(data: any): string[] {
  const tags = new Set<string>();
  
  if (data.trigger?.conceptDiffs) {
    data.trigger.conceptDiffs.forEach((concept: string) => tags.add(concept));
  }
  
  if (data.systemContext?.recentConcepts) {
    data.systemContext.recentConcepts.forEach((concept: string) => tags.add(concept));
  }
  
  if (data.conceptArc) {
    data.conceptArc.forEach((concept: string) => tags.add(concept));
  }
  
  tags.add(`persona-${data.persona.toLowerCase()}`);
  
  return Array.from(tags);
}

function calculatePhaseSignature(phaseMetrics: any): string {
  const { coherence = 0, entropy = 0, drift = 0 } = phaseMetrics || {};
  
  if (coherence > 0.8) return 'high-coherence';
  if (entropy > 0.8) return 'high-entropy';
  if (Math.abs(drift) > 0.5) return 'phase-drift';
  if (coherence > 0.6 && entropy < 0.4) return 'stable';
  return 'mixed-state';
}

function determineEmotionalTone(persona: string, userContext: any): string {
  const toneMap: Record<string, string> = {
    'Mentor': 'supportive',
    'Mystic': 'mystical',
    'Unsettled': 'anxious',
    'Chaotic': 'energetic',
    'Oracular': 'wise',
    'Dreaming': 'ethereal'
  };
  
  let tone = toneMap[persona] || 'neutral';
  
  if (userContext?.frustrationLevel > 0.7) {
    tone = 'concerned';
  } else if (userContext?.engagementLevel > 0.8) {
    tone = 'encouraging';
  }
  
  return tone;
}

function generateSearchableContent(data: any): string {
  const parts = [data.persona, data.eventType];
  
  if (data.content?.message) {
    parts.push(data.content.message.substring(0, 100));
  }
  
  if (data.trigger?.reason) {
    parts.push(data.trigger.reason);
  }
  
  return parts.join(' ');
}

function calculateMemoryWeight(data: any): number {
  let weight = 0.5;
  
  if (data.trigger?.confidence > 0.8) weight += 0.2;
  if (data.userContext?.frustrationLevel > 0.7) weight += 0.3;
  if (data.eventType === 'letter') weight = 0.9;
  
  return Math.min(1.0, weight);
}

function calculatePersonaDominance(persona: string, moodVector: Record<string, number>): number {
  const personaMoodMap: Record<string, string[]> = {
    'Mentor': ['empathy', 'supportiveness'],
    'Mystic': ['intuition', 'mystery'],
    'Unsettled': ['anxiety', 'concern'],
    'Chaotic': ['energy', 'unpredictability'],
    'Oracular': ['wisdom', 'foresight'],
    'Dreaming': ['creativity', 'imagination']
  };
  
  const relevantMoods = personaMoodMap[persona] || [];
  const totalMood = relevantMoods.reduce((sum, mood) => sum + (moodVector[mood] || 0), 0);
  
  return Math.min(1.0, totalMood / relevantMoods.length);
}

function generateReflectionSummary(memories: GhostMemoryEntry[]): string {
  const personaCount = new Set(memories.map(m => m.persona)).size;
  const avgWeight = memories.reduce((sum, m) => sum + m.indexing.memoryWeight, 0) / memories.length;
  
  return `Session involved ${personaCount} different personas across ${memories.length} interactions, with average significance of ${(avgWeight * 100).toFixed(0)}%.`;
}

function extractInsights(memories: GhostMemoryEntry[]): string[] {
  const insights: string[] = [];
  
  const personaCounts = memories.reduce((acc, m) => {
    acc[m.persona] = (acc[m.persona] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantPersona = Object.entries(personaCounts)
    .sort(([, a], [, b]) => b - a)[0];
  
  if (dominantPersona && dominantPersona[1] > memories.length * 0.4) {
    insights.push(`${dominantPersona[0]} persona emerged frequently, suggesting sustained ${dominantPersona[0].toLowerCase()} energy.`);
  }
  
  return insights;
}

function identifyPatterns(memories: GhostMemoryEntry[]): string[] {
  const patterns: string[] = [];
  
  // Identify phase-based patterns
  const phaseGroups = memories.reduce((acc, m) => {
    const phase = m.indexing.phaseSignature;
    acc[phase] = (acc[phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantPhase = Object.entries(phaseGroups)
    .sort(([, a], [, b]) => b - a)[0];
  
  if (dominantPhase) {
    patterns.push(`Most ghost activity occurred during ${dominantPhase[0]} phase states`);
  }
  
  return patterns;
}

function generateRecommendations(memories: GhostMemoryEntry[]): string[] {
  const recommendations: string[] = [];
  
  const effectiveInterventions = memories.filter(m =>
    m.outcomes?.effectiveness && m.outcomes.effectiveness > 0.7
  );
  
  if (effectiveInterventions.length > 0) {
    const effectivePersonas = [...new Set(effectiveInterventions.map(m => m.persona))];
    recommendations.push(`${effectivePersonas.join(' and ')} interventions have been most effective.`);
  }
  
  return recommendations;
}

// Export main service
export const ghostMemoryService = {
  initializeGhostMemoryConnection,
  recordGhostMemory,
  updateMoodCurve,
  recordInterventionOutcome,
  searchGhostMemories,
  generateGhostReflection,
  emitGhostEvent,
  getAll
};

export default ghostMemoryService;
