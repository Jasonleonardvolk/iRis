/**
 * Soliton Memory System - Advanced persistent memory with wave-like propagation
 * Creates stable, self-reinforcing memory patterns that persist and evolve
 */

interface SolitonMemoryEntry {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
  strength: number; // 0-1, how strong/important this memory is
  waveFunction: number[]; // Wave representation of the memory
  connections: string[]; // Connected memory IDs
  decayRate: number; // How fast this memory fades
  reinforcementCount: number; // How many times this memory has been accessed
  tags: string[];
  emotionalValence: number; // -1 to 1, emotional tone
  contextVector: number[]; // High-dimensional context representation
}

interface SolitonCluster {
  id: string;
  centerMemoryId: string;
  memberIds: string[];
  coherence: number; // How well the cluster holds together
  emergentProperties: string[];
  lastUpdate: Date;
}

class SolitonMemorySystem {
  private memories: Map<string, SolitonMemoryEntry> = new Map();
  private clusters: Map<string, SolitonCluster> = new Map();
  private updateInterval: number | null = null;
  
  constructor() {
    this.loadFromStorage();
    this.startPeriodicUpdates();
  }
  
  /**
   * Store a new memory with soliton wave properties
   */
  async storeMemory(
    userId: string, 
    id: string, 
    content: string, 
    strength: number = 0.8,
    tags: string[] = []
  ): Promise<SolitonMemoryEntry> {
    const memory: SolitonMemoryEntry = {
      id,
      userId,
      content,
      timestamp: new Date(),
      strength: Math.max(0, Math.min(1, strength)),
      waveFunction: this.generateWaveFunction(content),
      connections: [],
      decayRate: 0.01, // Slow decay by default
      reinforcementCount: 1,
      tags,
      emotionalValence: this.analyzeEmotionalTone(content),
      contextVector: this.generateContextVector(content)
    };
    
    this.memories.set(id, memory);
    await this.findConnections(memory);
    await this.updateClusters();
    this.saveToStorage();
    
    console.log(`🌊 Soliton Memory stored: ${id} (strength: ${strength})`);
    return memory;
  }
  
  /**
   * Retrieve memories with soliton interference patterns
   */
  async getMemories(
    userId: string, 
    query?: string, 
    limit: number = 10
  ): Promise<SolitonMemoryEntry[]> {
    let userMemories = Array.from(this.memories.values())
      .filter(m => m.userId === userId)
      .filter(m => m.strength > 0.1); // Only retrieve strong enough memories
    
    if (query) {
      // Calculate resonance with query
      const queryVector = this.generateContextVector(query);
      userMemories = userMemories
        .map(memory => ({
          memory,
          resonance: this.calculateResonance(memory.contextVector, queryVector) * memory.strength
        }))
        .sort((a, b) => b.resonance - a.resonance)
        .slice(0, limit)
        .map(item => item.memory);
    } else {
      // Sort by recency and strength
      userMemories = userMemories
        .sort((a, b) => {
          const aScore = a.strength * (1 + a.reinforcementCount * 0.1);
          const bScore = b.strength * (1 + b.reinforcementCount * 0.1);
          return bScore - aScore;
        })
        .slice(0, limit);
    }
    
    // Reinforce accessed memories
    userMemories.forEach(memory => this.reinforceMemory(memory.id));
    
    return userMemories;
  }
  
  /**
   * Get memory clusters (emergent patterns)
   */
  async getClusters(userId: string): Promise<SolitonCluster[]> {
    return Array.from(this.clusters.values())
      .filter(cluster => {
        const centerMemory = this.memories.get(cluster.centerMemoryId);
        return centerMemory?.userId === userId;
      })
      .sort((a, b) => b.coherence - a.coherence);
  }
  
  /**
   * Get memory statistics
   */
  getStats(userId: string) {
    const userMemories = Array.from(this.memories.values())
      .filter(m => m.userId === userId);
    
    const userClusters = Array.from(this.clusters.values())
      .filter(cluster => {
        const centerMemory = this.memories.get(cluster.centerMemoryId);
        return centerMemory?.userId === userId;
      });
    
    return {
      totalMemories: userMemories.length,
      strongMemories: userMemories.filter(m => m.strength > 0.7).length,
      totalClusters: userClusters.length,
      averageStrength: userMemories.reduce((sum, m) => sum + m.strength, 0) / userMemories.length,
      oldestMemory: userMemories.reduce((oldest, m) => 
        !oldest || m.timestamp < oldest.timestamp ? m : oldest, null as SolitonMemoryEntry | null
      ),
      mostReinforced: userMemories.reduce((most, m) => 
        !most || m.reinforcementCount > most.reinforcementCount ? m : most, null as SolitonMemoryEntry | null
      )
    };
  }
  
  /**
   * Generate wave function representation of content
   */
  private generateWaveFunction(content: string): number[] {
    const words = content.toLowerCase().split(/\s+/);
    const waveLength = 32; // Standard wave function length
    const wave = new Array(waveLength).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word) % waveLength;
      const amplitude = Math.sin((index / words.length) * Math.PI * 2);
      wave[hash] += amplitude * (word.length / 10); // Weight by word length
    });
    
    // Normalize
    const maxVal = Math.max(...wave.map(Math.abs));
    return maxVal > 0 ? wave.map(v => v / maxVal) : wave;
  }
  
  /**
   * Generate context vector for content
   */
  private generateContextVector(content: string): number[] {
    const words = content.toLowerCase().split(/\s+/);
    const vectorSize = 128;
    const vector = new Array(vectorSize).fill(0);
    
    words.forEach(word => {
      for (let i = 0; i < vectorSize; i++) {
        const hash = this.simpleHash(word + i.toString()) % 1000;
        vector[i] += Math.sin(hash / 159.15) * 0.1; // Distributed embedding
      }
    });
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
  }
  
  /**
   * Calculate resonance between two vectors
   */
  private calculateResonance(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) return 0;
    
    let dotProduct = 0;
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
    }
    
    return Math.max(0, dotProduct); // Cosine similarity (normalized vectors)
  }
  
  /**
   * Analyze emotional tone of content
   */
  private analyzeEmotionalTone(content: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'enjoy', 'happy', 'excited'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disappointed', 'worried'];
    
    const words = content.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }
  
  /**
   * Find connections between memories based on wave interference
   */
  private async findConnections(newMemory: SolitonMemoryEntry): Promise<void> {
    const threshold = 0.6; // Connection strength threshold
    
    for (const [id, existingMemory] of this.memories) {
      if (id === newMemory.id || existingMemory.userId !== newMemory.userId) continue;
      
      const resonance = this.calculateResonance(
        newMemory.contextVector, 
        existingMemory.contextVector
      );
      
      if (resonance > threshold) {
        newMemory.connections.push(id);
        existingMemory.connections.push(newMemory.id);
        console.log(`🌊 Soliton connection: ${newMemory.id} ↔ ${id} (${resonance.toFixed(3)})`);
      }
    }
  }
  
  /**
   * Update memory clusters based on connection patterns
   */
  private async updateClusters(): Promise<void> {
    this.clusters.clear();
    
    const processedMemories = new Set<string>();
    
    for (const [id, memory] of this.memories) {
      if (processedMemories.has(id) || memory.connections.length < 2) continue;
      
      const clusterMembers = [id];
      const toExplore = [...memory.connections];
      
      while (toExplore.length > 0) {
        const currentId = toExplore.pop()!;
        if (processedMemories.has(currentId) || clusterMembers.includes(currentId)) continue;
        
        const currentMemory = this.memories.get(currentId);
        if (!currentMemory || currentMemory.userId !== memory.userId) continue;
        
        // Check if this memory is well-connected to cluster members
        const connectionCount = currentMemory.connections.filter(c => clusterMembers.includes(c)).length;
        if (connectionCount >= Math.min(2, clusterMembers.length)) {
          clusterMembers.push(currentId);
          toExplore.push(...currentMemory.connections);
        }
      }
      
      if (clusterMembers.length >= 3) {
        const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const coherence = this.calculateClusterCoherence(clusterMembers);
        
        this.clusters.set(clusterId, {
          id: clusterId,
          centerMemoryId: id,
          memberIds: clusterMembers,
          coherence,
          emergentProperties: this.analyzeEmergentProperties(clusterMembers),
          lastUpdate: new Date()
        });
        
        clusterMembers.forEach(memberId => processedMemories.add(memberId));
        console.log(`🌊 Soliton cluster formed: ${clusterId} (${clusterMembers.length} memories, coherence: ${coherence.toFixed(3)})`);
      }
    }
  }
  
  /**
   * Calculate cluster coherence
   */
  private calculateClusterCoherence(memberIds: string[]): number {
    if (memberIds.length < 2) return 0;
    
    let totalResonance = 0;
    let pairCount = 0;
    
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const memoryA = this.memories.get(memberIds[i]);
        const memoryB = this.memories.get(memberIds[j]);
        
        if (memoryA && memoryB) {
          totalResonance += this.calculateResonance(memoryA.contextVector, memoryB.contextVector);
          pairCount++;
        }
      }
    }
    
    return pairCount > 0 ? totalResonance / pairCount : 0;
  }
  
  /**
   * Analyze emergent properties of a cluster
   */
  private analyzeEmergentProperties(memberIds: string[]): string[] {
    const properties: string[] = [];
    const memories = memberIds.map(id => this.memories.get(id)).filter(Boolean) as SolitonMemoryEntry[];
    
    // Check for common themes
    const allTags = memories.flatMap(m => m.tags);
    const tagCounts = allTags.reduce((counts, tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (count >= memories.length * 0.6) {
        properties.push(`dominant_theme:${tag}`);
      }
    });
    
    // Check emotional patterns
    const avgValence = memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;
    if (avgValence > 0.3) properties.push('positive_cluster');
    if (avgValence < -0.3) properties.push('negative_cluster');
    
    // Check temporal patterns
    const timeSpan = Math.max(...memories.map(m => m.timestamp.getTime())) - 
                   Math.min(...memories.map(m => m.timestamp.getTime()));
    if (timeSpan < 24 * 60 * 60 * 1000) properties.push('temporal_burst'); // Within 24 hours
    
    return properties;
  }
  
  /**
   * Reinforce memory (increase strength when accessed)
   */
  private reinforceMemory(id: string): void {
    const memory = this.memories.get(id);
    if (!memory) return;
    
    memory.reinforcementCount++;
    memory.strength = Math.min(1, memory.strength + 0.01); // Small reinforcement
    memory.decayRate *= 0.95; // Slower decay for frequently accessed memories
    
    this.memories.set(id, memory);
  }
  
  /**
   * Periodic updates to handle memory decay and evolution
   */
  private startPeriodicUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      this.applyDecay();
      this.saveToStorage();
    }, 60000); // Update every minute
  }
  
  /**
   * Apply decay to all memories
   */
  private applyDecay(): void {
    for (const [id, memory] of this.memories) {
      memory.strength *= (1 - memory.decayRate);
      
      // Remove very weak memories
      if (memory.strength < 0.05) {
        this.memories.delete(id);
        console.log(`🌊 Soliton memory faded: ${id}`);
      } else {
        this.memories.set(id, memory);
      }
    }
  }
  
  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        memories: Array.from(this.memories.entries()),
        clusters: Array.from(this.clusters.entries()),
        lastUpdate: new Date()
      };
      localStorage.setItem('soliton_memory_system', JSON.stringify(data));
    } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
      console.warn('Failed to save soliton memory to storage:', error);
    
}
  }
  
  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('soliton_memory_system');
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      this.memories = new Map(data.memories.map(([id, memory]: [string, any]) => [
        id,
        {
          ...memory,
          timestamp: new Date(memory.timestamp)
        }
      ]));
      
      this.clusters = new Map(data.clusters.map(([id, cluster]: [string, any]) => [
        id,
        {
          ...cluster,
          lastUpdate: new Date(cluster.lastUpdate)
        }
      ]));
      
      console.log(`🌊 Loaded ${this.memories.size} soliton memories and ${this.clusters.size} clusters`);
    } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
      console.warn('Failed to load soliton memory from storage:', error);
    
}
  }
  
  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.saveToStorage();
  }
}

// Create singleton instance
const solitonMemory = new SolitonMemorySystem();

// Export the service
export default solitonMemory;
