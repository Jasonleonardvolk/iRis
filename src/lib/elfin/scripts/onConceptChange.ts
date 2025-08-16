import { addConceptDiff, concepts } from '$lib/stores/conceptMesh';
// lib/elfin/scripts/onConceptChange.ts - Concept Change Event Script
import { highlightConcepts, setActiveConcept, connectConcepts } from '$lib/stores/conceptMesh';
import { Ghost } from '$lib/stores/ghostPersona';
interface ConceptChangeContext {
  concepts: string[];
  action: 'add' | 'highlight' | 'connect' | 'remove';
  metadata?: Record<string, any>;
  sourceGhost?: string;
}
/**
 * ELFIN++ Script: onConceptChange
 * Responds to changes in the concept mesh by updating visualizations
 * and potentially triggering ghost responses
 */
export async function onConceptChange(context: ConceptChangeContext): Promise<void> {
  const { concepts, action, metadata = {}, sourceGhost } = context;
  
  console.log('🌐 ELFIN++ onConceptChange: Processing concept updates', {
    concepts,
    action,
    sourceGhost
  });
  try {
    switch (action) {
      case 'add':
      case 'highlight':
        // Convert concepts to the expected format for highlighting
        const conceptObjects = concepts.map(name => ({
          name,
          strength: metadata.strength || 0.7,
          type: metadata.type || 'general'
        }));
        
        // Highlight concepts in Thoughtspace
      const recentConcepts = Array.from(concepts).slice(-10);
            addConceptDiff({type: "link", title: "Concept Links", concepts: recentConcepts.map((c: any) => typeof c === "string" ? c : c.name), summary: "Linking recent concepts"});
        
        // Set the first concept as active
        if (concepts.length > 0) {
          setActiveConcept(concepts[0]);
        }
        
        console.log(`✨ ELFIN++ Highlighted ${concepts.length} concepts in Thoughtspace`);
        break;
        
      case 'connect':
        // Create connections between concepts
        if (concepts.length >= 2) {
          for (let i = 0; i < concepts.length - 1; i++) {
            connectConcepts(concepts[i], concepts[i + 1], metadata.connectionStrength || 0.5);
          }
          console.log(`🔗 ELFIN++ Connected ${concepts.length} concepts`);
        }
        break;
        
      case 'remove':
        // Handle concept removal (if needed)
        console.log(`🗑️ ELFIN++ Removing concepts: ${concepts.join(', ')}`);
        break;
        
      default:
        console.warn(`⚠️ ELFIN++ Unknown concept action: ${action}`);
    }
    // If this change came from a ghost, potentially trigger responses from other ghosts
    if (sourceGhost && concepts.length > 0) {
      await triggerGhostResponses(concepts, sourceGhost, metadata);
    }
  } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ ELFIN++ onConceptChange execution failed:', error);
    throw error;
  
}
}
/**
 * Trigger responses from other ghosts based on new concepts
 */
async function triggerGhostResponses(concepts: string[], sourceGhost: string, metadata: any): Promise<void> {
  const ghostNames = ['Mentor', 'Scholar', 'Explorer', 'Architect', 'Creator'];
  
  for (const ghostName of ghostNames) {
    if (ghostName === sourceGhost) continue; // Don't trigger the source ghost
    
    const ghost = Ghost(ghostName);
    if (!ghost) continue;
    
    // Check if this ghost should respond to these concepts
    const shouldRespond = await ghost.shouldRespondTo?.(concepts, metadata);
    
    if (shouldRespond) {
      console.log(`👻 ELFIN++ ${ghostName} responding to concepts from ${sourceGhost}`);
      
      try {
        await ghost.respondToConcepts?.(concepts, {
          sourceGhost,
          action: 'concept_introduced',
          ...metadata
        });
      } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ ELFIN++ ${ghostName
} response failed:`, error);
      }
    }
  }
}
console.log('🌐 ELFIN++ onConceptChange script loaded');