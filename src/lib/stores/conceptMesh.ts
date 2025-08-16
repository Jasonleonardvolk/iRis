import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// ---- Canonical ConceptDiff types (single source of truth) ----
export type ConceptDiffType =
  | 'document' | 'manual' | 'chat' | 'system'
  | 'add' | 'remove' | 'modify' | 'relate' | 'unrelate'
  | 'extract' | 'link' | 'memory';

export interface ConceptDiff {
  id: string;
  type: ConceptDiffType;
  title: string;
  concepts: string[];
  summary?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  changes?: Array<{ field: string; from: any; to: any }>;
}

export const buildConceptDiff = (
  diff: Omit<ConceptDiff, 'id' | 'timestamp'> & Partial<Pick<ConceptDiff, 'id' | 'timestamp' | 'changes'>>
): ConceptDiff => ({
  id: diff.id ?? `diff_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  timestamp: diff.timestamp ?? new Date(),
  changes: diff.changes ?? [],
  ...diff
});
// ---- End canonical types ----

// ========== 1. Define what "diff" actually means in the mesh ==========
export enum DiffType {
  NODE_ADD = 'NODE_ADD',           // new concept id appears
  NODE_DELETE = 'NODE_DELETE',     // id removed
  NODE_UPDATE = 'NODE_UPDATE',     // weight/phase/label altered
  EDGE_ADD = 'EDGE_ADD',          // relation added
  EDGE_DELETE = 'EDGE_DELETE',    // relation cut
  EDGE_WEIGHT_SHIFT = 'EDGE_WEIGHT_SHIFT' // edge weight Δ ≥ ε
}

export interface ConceptNode {
  id: string;
  label: string;
  phaseTag?: number;
  weight?: number;
  category?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  last_accessed?: string;
  access_count?: number;
}

export interface ConceptEdge {
  from: string;
  to: string;
  weight: number;
  relationType: string;
  bidirectional?: boolean;
  metadata?: Record<string, any>;
}

export interface DiffEvent {
  type: DiffType;
  id?: string;
  node?: ConceptNode;
  edge?: ConceptEdge;
  before?: ConceptNode | number;  // for updates, the previous state
  after?: ConceptNode | number;   // for updates, the new state
  key?: string;                   // for edge deletes
  from?: string;                  // for edge weight shifts
  to?: string;                    // for edge weight shifts
  timestamp?: Date;
}

// ========== 2. Keep a rolling snapshot in memory ==========
export type MeshSnapshot = {
  nodes: Map<string, ConceptNode>;   // id → node
  edges: Map<string, ConceptEdge>;   // "from|to" → edge
  timestamp: Date;
}

// For backwards compatibility with existing code
export interface Concept extends ConceptNode {
  name: string;  // alias for label
  description?: string;
  importance?: number;  // alias for weight
}

export interface ConceptRelation extends ConceptEdge {
  source_id: string;  // alias for from
  target_id: string;  // alias for to
  strength?: number;  // alias for weight
}



export interface ConceptMesh {
  nodes: Map<string, ConceptNode>;
  edges: Map<string, ConceptEdge>;
}

// EventBus implementation
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
          console.error(`Error in event handler for ${event
}:`, error);
        }
      });
    }
  }
}

class ConceptMeshStore {
  private concepts: Writable<Concept[]>;
  public conceptNodes: Writable<Map<string, ConceptNode>>;
  private conceptEdges: Writable<Map<string, ConceptEdge>>;
  private diffs: Writable<ConceptDiff[]>;
  private diffEvents: Writable<DiffEvent[]>;
  private pythonBridge: any = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  
  // Diff engine state
  private lastSnapshot: MeshSnapshot | null = null;
  private lastCalculatedDiff: DiffEvent[] = [];
  private eventBus: EventBus = new EventBus();
  
  // Configuration
  private readonly WEIGHT_DRIFT_THRESHOLD = 0.05;
  private readonly MAX_DIFFS_STORED = 1000;

  constructor() {
    this.concepts = writable<Concept[]>([]);
    this.conceptNodes = writable<Map<string, ConceptNode>>(new Map());
    this.conceptEdges = writable<Map<string, ConceptEdge>>(new Map());
    this.diffs = writable<ConceptDiff[]>([]);
    this.diffEvents = writable<DiffEvent[]>([]);
    
    // Initialize Python bridge if available
    this.initializeBridge();
    
    // Set up internal event handling for diff calculation
    this.setupDiffEngine();
    
    // Set up event listeners
    if (typeof window !== 'undefined') {
      // Listen for concept diff events
      window.addEventListener('tori-concept-diff', this.handleConceptDiffEvent.bind(this));
      
      // Listen for other concept-related events
      window.addEventListener('tori-concept-add', this.handleConceptAddEvent.bind(this));
      window.addEventListener('tori-concept-relate', this.handleConceptRelateEvent.bind(this));
    }
  }

  // ========== 3. Compute diffs on mesh:updated event ==========
  private setupDiffEngine() {
    this.eventBus.on('mesh:updated', (mesh: ConceptMesh) => {
      const current = this.snapshotOf(mesh);
      if (this.lastSnapshot) {
        const diff = this.diffSnapshots(this.lastSnapshot, current);
        if (diff.length) {
          this.lastCalculatedDiff = diff;
          this.eventBus.emit('mesh:diff', diff);
          
          // Store diff events
          this.diffEvents.update(events => {
            const newEvents = [...events, ...diff];
            return newEvents.slice(-this.MAX_DIFFS_STORED);
          });
        }
      }
      this.lastSnapshot = current;
    });
  }

  private snapshotOf(mesh: ConceptMesh): MeshSnapshot {
    // Create a frozen snapshot of the current mesh state
    const nodesCopy = new Map<string, ConceptNode>();
    const edgesCopy = new Map<string, ConceptEdge>();
    
    mesh.nodes.forEach((node, id) => {
      nodesCopy.set(id, { ...node });  // shallow copy is fine for our purposes
    });
    
    mesh.edges.forEach((edge, key) => {
      edgesCopy.set(key, { ...edge });
    });
    
    return {
      nodes: nodesCopy,
      edges: edgesCopy,
      timestamp: new Date()
    };
  }

  // ========== 4. The diff algorithm (O(N) on maps) ==========
  private diffSnapshots(prev: MeshSnapshot, curr: MeshSnapshot): DiffEvent[] {
    const events: DiffEvent[] = [];

    // 1) node adds / deletes / updates
    for (const [id, node] of curr.nodes) {
      if (!prev.nodes.has(id)) {
        events.push({ 
          type: DiffType.NODE_ADD, 
          id, 
          node,
          timestamp: new Date()
        });
      } else {
        const before = prev.nodes.get(id)!;
        if (before.phaseTag !== node.phaseTag || 
            before.weight !== node.weight ||
            before.label !== node.label) {
          events.push({ 
            type: DiffType.NODE_UPDATE, 
            id, 
            before, 
            after: node,
            timestamp: new Date()
          });
        }
      }
    }
    
    for (const id of prev.nodes.keys()) {
      if (!curr.nodes.has(id)) {
        events.push({ 
          type: DiffType.NODE_DELETE, 
          id,
          timestamp: new Date()
        });
      }
    }

    // 2) edge adds / deletes / weight drift
    for (const [key, edge] of curr.edges) {
      if (!prev.edges.has(key)) {
        events.push({ 
          type: DiffType.EDGE_ADD, 
          edge,
          timestamp: new Date()
        });
      } else {
        const before = prev.edges.get(key)!;
        if (Math.abs(before.weight - edge.weight) > this.WEIGHT_DRIFT_THRESHOLD) {
          events.push({ 
            type: DiffType.EDGE_WEIGHT_SHIFT, 
            from: edge.from, 
            to: edge.to, 
            before: before.weight, 
            after: edge.weight,
            timestamp: new Date()
          });
        }
      }
    }
    
    for (const key of prev.edges.keys()) {
      if (!curr.edges.has(key)) {
        events.push({ 
          type: DiffType.EDGE_DELETE, 
          key,
          timestamp: new Date()
        });
      }
    }

    return events;
  }

  // ========== 5. Expose a public API for the UI / other services ==========
  public onConceptDiff(callback: (events: DiffEvent[]) => void) {
    this.eventBus.on('mesh:diff', callback);
    return () => this.eventBus.off('mesh:diff', callback);  // return unsubscribe function
  }

  public async getLastDiff(): Promise<DiffEvent[]> {
    return this.lastCalculatedDiff;
  }

  public getCurrentMesh(): ConceptMesh {
    return {
      nodes: get(this.conceptNodes),
      edges: get(this.conceptEdges)
    };
  }

  // Trigger a mesh update to calculate diffs
  private updateMesh() {
    const mesh = this.getCurrentMesh();
    this.eventBus.emit('mesh:updated', mesh);
  }

  // Legacy bridge initialization
  private async initializeBridge() {
    try {
      if (typeof window !== 'undefined') {
        this.pythonBridge = {
          call: async (method: string, params: any) => {
            const response = await fetch('/api/concept-mesh/' + method, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params)
            });
            if (!response.ok) throw new Error(`API call failed: ${response.statusText}`);
            return response.json();
          },
          on: (event: string, handler: Function) => {
            this.eventHandlers.set(event, [...(this.eventHandlers.get(event) || []), handler]);
          }
        };
        
        console.log('✅ ConceptMesh API bridge initialized');
      }
    } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
      console.warn('ConceptMesh running without Python bridge:', error);
    
}
  }

  // Legacy event handlers
  private handleConceptDiffEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const diff = customEvent.detail as ConceptDiff;
    
    this.addConceptDiff({
      ...diff,
      timestamp: diff.timestamp || new Date()
    });
    
    this.emit('diff-processed', diff);
  }

  private handleConceptAddEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const concept = customEvent.detail as Concept;
    
    // Add to new node system
    const node: ConceptNode = {
      id: concept.id,
      label: concept.name || concept.label,
      phaseTag: 0.5,  // default phase
      weight: concept.importance || concept.weight || 1.0,
      category: concept.category,
      metadata: concept.metadata,
      created_at: concept.created_at
    };
    
    this.conceptNodes.update(nodes => {
      const newNodes = new Map(nodes);
      newNodes.set(node.id, node);
      return newNodes;
    });
    
    // Also add to legacy concepts array
    this.concepts.update(concepts => [...concepts, concept]);
    
    // Trigger mesh update for diff calculation
    this.updateMesh();
    
    // Create legacy diff
    this.addConceptDiff({
      type: 'add',
      title: `Added concept: ${concept.name}`,
      concepts: [concept.id],
      metadata: { concept }
    });
  }

  private handleConceptRelateEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const relation = customEvent.detail as ConceptRelation;
    
    // Add to new edge system
    const edge: ConceptEdge = {
      from: relation.source_id || relation.from,
      to: relation.target_id || relation.to,
      weight: relation.strength || relation.weight || 1.0,
      relationType: relation.relationType || 'related',
      bidirectional: relation.bidirectional,
      metadata: relation.metadata
    };
    
    const key = `${edge.from}|${edge.to}`;
    
    this.conceptEdges.update(edges => {
      const newEdges = new Map(edges);
      newEdges.set(key, edge);
      return newEdges;
    });
    
    // Trigger mesh update for diff calculation
    this.updateMesh();
    
    // Create legacy diff
    this.addConceptDiff({
      type: 'relate',
      title: `Related concepts`,
      concepts: [edge.from, edge.to],
      summary: `${edge.relationType} (strength: ${edge.weight})`,
      metadata: { relation }
    });
  }

  // Legacy diff system (kept for backwards compatibility)
  public addConceptDiff(
    diff: Omit<ConceptDiff, 'id' | 'timestamp'> & Partial<Pick<ConceptDiff, 'id' | 'timestamp' | 'changes'>>
  ) {
    const completeDiff: ConceptDiff = {
      id: diff.id || `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: diff.timestamp || new Date(),
      changes: diff.changes || [],
      type: diff.type,
      title: diff.title,
      concepts: diff.concepts || [],
      summary: diff.summary,
      metadata: diff.metadata || {}
    };
    
    this.diffs.update(diffs => {
      const newDiffs = [...diffs, completeDiff];
      return newDiffs.slice(-this.MAX_DIFFS_STORED);
    });
    
    if (this.pythonBridge) {
      this.pythonBridge.call('record_diff', completeDiff).catch((error: any) => {
        console.error('Failed to sync diff to Python:', error);
      });
    }
    
    console.log(`📝 Concept diff: ${completeDiff.type} - ${completeDiff.title}`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori-concept-diff-recorded', {
        detail: completeDiff
      }));
    }
  }

  /**
   * Remove a previously recorded ConceptDiff by its id and
   * broadcast an event so UI components can react.
   */
  public removeConceptDiff(diffId: string): void {
    if (!diffId) return;
    
    // Drop from legacy diff list
    this.diffs.update(diffs => diffs.filter(d => d.id !== diffId));
    
    // If you mirror diffEvents by id, clear those too
    this.diffEvents.update(events => events.filter(e => e.id !== diffId));
    
    // Notify any listeners (optional)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tori-concept-diff-removed', { detail: { diffId } })
      );
    }
    
    console.log(`🗑️ Removed concept diff: ${diffId}`);
  }

  public async addConcept(
    name: string,
    description?: string,
    category?: string,
    importance?: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (this.pythonBridge) {
      try {
        const conceptId = await this.pythonBridge.call('add_concept', {
          name,
          description,
          category,
          importance,
          metadata
        });
        
        await this.refreshConcepts();
        return conceptId;
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to add concept via Python:', error);
      
}
    }
    
    // Local implementation
    const conceptId = `concept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const concept: Concept = {
      id: conceptId,
      name,
      label: name,
      description,
      category: category || 'general',
      importance: importance || 1.0,
      weight: importance || 1.0,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      access_count: 0
    };
    
    // Add to both systems
    this.concepts.update(concepts => [...concepts, concept]);
    
    const node: ConceptNode = {
      id: conceptId,
      label: name,
      phaseTag: 0.5,
      weight: importance || 1.0,
      category: category || 'general',
      metadata: metadata || {},
      created_at: concept.created_at
    };
    
    this.conceptNodes.update(nodes => {
      const newNodes = new Map(nodes);
      newNodes.set(node.id, node);
      return newNodes;
    });
    
    // Trigger mesh update
    this.updateMesh();
    
    // Create diff
    this.addConceptDiff({
      type: 'add',
      title: `Added concept: ${name}`,
      concepts: [conceptId],
      metadata: { concept }
    });
    
    return conceptId;
  }

  public async addEdge(
    from: string,
    to: string,
    weight: number = 1.0,
    relationType: string = 'related',
    bidirectional: boolean = false
  ): Promise<void> {
    const edge: ConceptEdge = {
      from,
      to,
      weight,
      relationType,
      bidirectional
    };
    
    const key = `${from}|${to}`;
    
    this.conceptEdges.update(edges => {
      const newEdges = new Map(edges);
      newEdges.set(key, edge);
      
      // Add reverse edge if bidirectional
      if (bidirectional) {
        const reverseKey = `${to}|${from}`;
        newEdges.set(reverseKey, {
          from: to,
          to: from,
          weight,
          relationType,
          bidirectional
        });
      }
      
      return newEdges;
    });
    
    // Trigger mesh update
    this.updateMesh();
  }

  public async findConcept(name: string): Promise<Concept | null> {
    if (this.pythonBridge) {
      try {
        return await this.pythonBridge.call('find_concept', name);
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to find concept via Python:', error);
      
}
    }
    
    const concepts = get(this.concepts);
    return concepts.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
  }

  public async getRelatedConcepts(
    conceptId: string,
    relationType?: string,
    maxDepth: number = 1
  ): Promise<Array<{ conceptId: string; relationType: string; strength: number }>> {
    if (this.pythonBridge) {
      try {
        const related = await this.pythonBridge.call('get_related_concepts', {
          concept_id: conceptId,
          relation_type: relationType,
          max_depth: maxDepth
        });
        
        return related.map((r: any) => ({
          conceptId: r[0],
          relationType: r[1],
          strength: r[2]
        }));
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to get related concepts via Python:', error);
      
}
    }
    
    // Local implementation using edges
    const edges = get(this.conceptEdges);
    const related: Array<{ conceptId: string; relationType: string; strength: number }> = [];
    
    edges.forEach((edge, key) => {
      if (edge.from === conceptId && (!relationType || edge.relationType === relationType)) {
        related.push({
          conceptId: edge.to,
          relationType: edge.relationType,
          strength: edge.weight
        });
      }
    });
    
    return related;
  }

  public async extractConceptsFromText(text: string, minImportance: number = 0.5): Promise<string[]> {
    if (this.pythonBridge) {
      try {
        const conceptIds = await this.pythonBridge.call('extract_concepts_from_text', {
          text,
          min_importance: minImportance
        });
        
        await this.refreshConcepts();
        
        this.addConceptDiff({
          type: 'extract',
          title: 'Extracted concepts from text',
          concepts: conceptIds,
          summary: `Found ${conceptIds.length} concepts`,
          metadata: { source_text: text.substring(0, 100) + '...' }
        });
        
        return conceptIds;
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to extract concepts via Python:', error);
      
}
    }
    
    // Simple extraction
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const conceptIds: string[] = [];
    
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        const conceptId = await this.addConcept(word, '', 'extracted', 0.5);
        conceptIds.push(conceptId);
      }
    }
    
    return conceptIds;
  }

  public async getStatistics(): Promise<Record<string, any>> {
    if (this.pythonBridge) {
      try {
        return await this.pythonBridge.call('get_statistics');
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to get statistics via Python:', error);
      
}
    }
    
    const concepts = get(this.concepts);
    const diffs = get(this.diffs);
    const nodes = get(this.conceptNodes);
    const edges = get(this.conceptEdges);
    const diffEvents = get(this.diffEvents);
    
    return {
      total_concepts: concepts.length,
      total_nodes: nodes.size,
      total_edges: edges.size,
      total_diffs: diffs.length,
      total_diff_events: diffEvents.length,
      categories: [...new Set(concepts.map(c => c.category))],
      recent_activity: diffs.slice(-10).map(d => ({
        type: d.type,
        title: d.title,
        timestamp: d.timestamp
      })),
      recent_diff_events: diffEvents.slice(-10).map(e => ({
        type: e.type,
        id: e.id,
        timestamp: e.timestamp
      }))
    };
  }

  private async refreshConcepts() {
    if (this.pythonBridge) {
      try {
        const allConcepts = await this.pythonBridge.call('get_all_concepts');
        this.concepts.set(allConcepts);
        
        // Also refresh nodes
        const nodes = new Map<string, ConceptNode>();
        allConcepts.forEach((concept: Concept) => {
          nodes.set(concept.id, {
            id: concept.id,
            label: concept.name || concept.label,
            phaseTag: 0.5,
            weight: concept.importance || concept.weight || 1.0,
            category: concept.category,
            metadata: concept.metadata,
            created_at: concept.created_at
          });
        });
        this.conceptNodes.set(nodes);
        
        // Trigger mesh update
        this.updateMesh();
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to refresh concepts from Python:', error);
      
}
    }
  }

  // Event handling
  public on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
          console.error(`Error in event handler for ${event
}:`, error);
        }
      });
    }
  }

  /**
   * Hard-reset the in-memory mesh and associated diffs/events.
   * Fires 'mesh:cleared' on the internal bus and a
   * 'tori-concept-mesh-cleared' DOM event for UI listeners.
   */
  public clearConceptMesh(): void {
    // zero the writable stores
    this.concepts.set([]);
    this.conceptNodes.set(new Map());
    this.conceptEdges.set(new Map());
    this.diffs.set([]);
    this.diffEvents.set([]);
    
    // reset diff engine state
    this.lastSnapshot = null;
    this.lastCalculatedDiff = [];
    
    // notify subscribers
    this.eventBus.emit('mesh:cleared');
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori-concept-mesh-cleared'));
    }
    
    console.log('🧹 Concept mesh fully cleared');
  }

  // Store access
  public get conceptsStore(): Readable<Concept[]> {
    return { subscribe: this.concepts.subscribe };
  }

  public get conceptNodesStore(): Readable<Map<string, ConceptNode>> {
    return { subscribe: this.conceptNodes.subscribe };
  }

  public get conceptEdgesStore(): Readable<Map<string, ConceptEdge>> {
    return { subscribe: this.conceptEdges.subscribe };
  }

  public get diffsStore(): Readable<ConceptDiff[]> {
    return { subscribe: this.diffs.subscribe };
  }

  public get diffEventsStore(): Readable<DiffEvent[]> {
    return { subscribe: this.diffEvents.subscribe };
  }
}

// Create singleton instance
export const conceptMeshStore = new ConceptMeshStore();

// Export stores
export const conceptMesh = conceptMeshStore.diffsStore;
export const concepts = conceptMeshStore.conceptsStore;
export const conceptNodes = conceptMeshStore.conceptNodesStore;
export const conceptEdges = conceptMeshStore.conceptEdgesStore;
export const diffEvents = conceptMeshStore.diffEventsStore;

// Export convenience functions - Builder pattern for ConceptDiff
export const addConceptDiff = (
  diff: Omit<ConceptDiff, 'id' | 'timestamp'> & Partial<Pick<ConceptDiff, 'id' | 'timestamp' | 'changes'>>
) => conceptMeshStore.addConceptDiff(diff);
export const removeConceptDiff = (diffId: string) => conceptMeshStore.removeConceptDiff(diffId);
export const addConcept = (name: string, description?: string, category?: string) => 
  conceptMeshStore.addConcept(name, description, category);
export const addEdge = (from: string, to: string, weight?: number, relationType?: string) => 
  conceptMeshStore.addEdge(from, to, weight, relationType);
export const findConcept = (name: string) => conceptMeshStore.findConcept(name);
export const extractConcepts = (text: string) => conceptMeshStore.extractConceptsFromText(text);
export const onConceptDiff = (callback: (events: DiffEvent[]) => void) => 
  conceptMeshStore.onConceptDiff(callback);
export const getLastDiff = () => conceptMeshStore.getLastDiff();
export const getCurrentMesh = () => conceptMeshStore.getCurrentMesh();
export const clearConceptMesh = () => conceptMeshStore.clearConceptMesh();

// Missing functions for ELFIN integration
export const highlightConcepts = (conceptIds: string[]) => {
  // Emit event for UI highlighting
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('concept-highlight', {
      detail: { conceptIds }
    }));
  }
  console.log('✨ Highlighting concepts:', conceptIds);
};

export const setActiveConcept = (conceptId: string) => {
  // Emit event for setting active concept
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('concept-set-active', {
      detail: { conceptId }
    }));
  }
  console.log('🎯 Setting active concept:', conceptId);
};

export const connectConcepts = async (fromId: string, toId: string, relationType: string = 'related') => {
  // Use the existing addEdge function
  await addEdge(fromId, toId, 1.0, relationType);
  console.log(`🔗 Connected concepts: ${fromId} -> ${toId} (${relationType})`);
};

// System entropy function for document processing
// Note: This is now replaced by the ELFIN version below

// Ghost Memory Interface
export interface GhostMemory {
  concept: string;  // e.g., "ghost.memory.serenity.2025.g0"
  content: string | any;  // JSON stringified or raw content
  phaseTag: number;  // ψ value, typically around 0.42 for ghosts
  importance?: number;  // Weight/strength of the memory
  metadata?: {
    persona?: string;  // serenity, unsettled, etc.
    generation?: number;  // g0, g1, g2...
    timestamp?: string;
    solitonPattern?: 'singlet' | 'doublet' | 'triplet';  // Soliton cluster type
    mood?: number[];  // Mood vector
    trace?: string[];  // Memory trace descriptors
  };
}

// Store a ghost memory in the mesh
export const storeMemory = async (memory: GhostMemory): Promise<string> => {
  // Parse the concept ID to extract metadata
  const parts = memory.concept.split('.');
  const persona = parts[2] || 'unknown';
  const year = parts[3] || new Date().getFullYear().toString();
  const generation = parts[4] || 'g0';
  
  // Prepare metadata
  const metadata = {
    ...memory.metadata,
    persona,
    generation: parseInt(generation.substring(1)) || 0,
    phaseTag: memory.phaseTag,
    ghostMemory: true,
    timestamp: memory.metadata?.timestamp || new Date().toISOString()
  };
  
  // Parse content if it's a string
  let contentData = memory.content;
  if (typeof memory.content === 'string') {
    try {
      contentData = JSON.parse(memory.content);
    } catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
      // Keep as string if not valid JSON
    
}
  }
  
  // Store in the concept mesh
  const conceptId = await conceptMeshStore.addConcept(
    memory.concept,
    JSON.stringify(contentData),
    'ghost.memory',
    memory.importance || 0.6,
    metadata
  );
  
  // Add phase-specific node data
  conceptMeshStore.conceptNodes.update(nodes => {
    const newNodes = new Map(nodes);
    const node = newNodes.get(conceptId);
    if (node) {
      node.phaseTag = memory.phaseTag;
      newNodes.set(conceptId, node);
    }
    return newNodes;
  });
  
  // Trigger mesh update for diff calculation
  conceptMeshStore['updateMesh']();
  
  // Log the ghost memory storage
  console.log(`👻 Ghost memory stored: ${memory.concept} (ψ=${memory.phaseTag.toFixed(3)})`);
  
  // Emit ghost memory event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ghost-memory-stored', {
      detail: { conceptId, memory }
    }));
  }
  
  return conceptId;
};

// Recall ghost memories by persona and/or phase range
export const recallGhostMemories = async (
  persona?: string,
  phaseMin: number = 0.4,
  phaseMax: number = 0.45
): Promise<Array<{ concept: Concept; memory: GhostMemory }>> => {
  const allConcepts = get(concepts);
  const nodes = get(conceptNodes);
  
  return allConcepts
    .filter(c => {
      // Filter by category
      if (c.category !== 'ghost.memory') return false;
      
      // Filter by persona if provided
      if (persona && c.metadata?.persona !== persona) return false;
      
      // Filter by phase range
      const node = nodes.get(c.id);
      if (!node || node.phaseTag === undefined) return false;
      if (node.phaseTag < phaseMin || node.phaseTag > phaseMax) return false;
      
      return true;
    })
    .map(concept => {
      const node = nodes.get(concept.id);
      const memory: GhostMemory = {
        concept: concept.name,
        content: concept.description || '',
        phaseTag: node?.phaseTag || 0.42,
        importance: concept.importance,



        metadata: concept.metadata
      };
      return { concept, memory };
    });
};

// Phase band allocations for ghost personas
export const GHOST_PHASE_BANDS = {
  serenity: { min: 0.420, max: 0.429 },
  unsettled: { min: 0.430, max: 0.439 },
  curious: { min: 0.440, max: 0.449 },
  melancholic: { min: 0.410, max: 0.419 },
  energetic: { min: 0.450, max: 0.459 },
  contemplative: { min: 0.400, max: 0.409 },
  // Reserve 0.460-0.499 for future personas
} as const;

// Get recommended phase for a persona
export const getGhostPhase = (persona: string): number => {
  const band = GHOST_PHASE_BANDS[persona as keyof typeof GHOST_PHASE_BANDS];
  if (!band) return 0.42; // Default ghost phase
  
  // Return midpoint of the band with slight randomness
  const midpoint = (band.min + band.max) / 2;
  const jitter = (Math.random() - 0.5) * 0.002; // ±0.001 jitter
  return midpoint + jitter;
};

// System entropy monitoring
export const systemEntropy = derived(
  [conceptNodes, conceptEdges],
  ([$nodes, $edges]) => {
    const nodeCount = $nodes.size;
    const edgeCount = $edges.size;
    const connectivity = nodeCount > 0 ? edgeCount / nodeCount : 0;
    const complexity = Math.log2(nodeCount + 1) + Math.log2(edgeCount + 1);
    
    return {
      nodeCount,
      edgeCount,
      connectivity: connectivity.toFixed(3),
      complexity: complexity.toFixed(3),
      entropy: (complexity * connectivity).toFixed(3)
    };
  }
);

// Derived store for recent diffs
export const recentDiffs = derived(
  conceptMesh,
  $diffs => $diffs.slice(-20).reverse()
);

// Derived store for recent diff events
export const recentDiffEvents = derived(
  diffEvents,
  $events => $events.slice(-20).reverse()
);

// Derived store for concept categories
export const conceptCategories = derived(
  concepts,
  $concepts => {
    const categories = new Set($concepts.map(c => c.category || 'general'));
    return Array.from(categories);
  }
);

// Derived store for concept count by category
export const conceptsByCategory = derived(
  concepts,
  $concepts => {
    const counts: Record<string, number> = {};
    $concepts.forEach(c => {
      const category = c.category || 'general';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }
);

// Add missing exports for ELFIN ghost state management
const ghostStateStore = writable<{
  lastTriggeredGhost: string | null;
  lastTriggeredTime: string | null;
}>({
  lastTriggeredGhost: null,
  lastTriggeredTime: null
});

export const setLastTriggeredGhost = (ghostName: string) => {
  ghostStateStore.set({
    lastTriggeredGhost: ghostName,
    lastTriggeredTime: new Date().toISOString()
  });
};

// System entropy management for ELFIN
const elfinSystemEntropyStore = writable<number>(0);

export const updateSystemEntropy = (change: number) => {
  elfinSystemEntropyStore.update(entropy => {
    const newEntropy = Math.max(0, Math.min(100, entropy + change));
    console.log(`🌡️ System entropy changed: ${entropy} → ${newEntropy} (${change > 0 ? '+' : ''}${change})`);
    return newEntropy;
  });
};

export const elfinSystemEntropy = { subscribe: elfinSystemEntropyStore.subscribe };

// ========== 6. Unit test helpers (export for testing) ==========
export const testHelpers = {
  createMockMesh: (): ConceptMesh => ({
    nodes: new Map([
      ['node1', { id: 'node1', label: 'Test Node 1', phaseTag: 0.5, weight: 1.0 }],
      ['node2', { id: 'node2', label: 'Test Node 2', phaseTag: 0.7, weight: 0.8 }]
    ]),
    edges: new Map([
      ['node1|node2', { from: 'node1', to: 'node2', weight: 0.6, relationType: 'related' }]
    ])
  }),
  
  snapshotOf: (mesh: ConceptMesh) => conceptMeshStore['snapshotOf'](mesh),
  diffSnapshots: (prev: MeshSnapshot, curr: MeshSnapshot) => 
    conceptMeshStore['diffSnapshots'](prev, curr)
};

// Export systemCoherence
export const systemCoherence = writable(1.0);