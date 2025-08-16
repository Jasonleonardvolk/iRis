// TEMPORARY FIX: Redirect enhancedApiService to our real API
export const enhancedApiService = {
  async generateResponse(context: any) {
    console.log('🔄 Redirecting enhancedApiService to real chat API');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: context.userQuery || 'Hello',
          userId: context.userProfile?.name || 'anonymous'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Transform to match expected format
      return {
        response: result.response,
        newConcepts: result.concepts_found || [],
        confidence: result.confidence || 0.8,
        processingMethod: 'real_chat_api',
        systemInsights: [
          `Found ${result.concepts_found?.length || 0} relevant concepts`,
          `Confidence: ${Math.round((result.confidence || 0.8) * 100)}%`,
          `Processing time: ${(result.processing_time || 0).toFixed(3)}s`,
          `Soliton Memory used: ${result.soliton_memory_used ? 'Yes' : 'No'}`
        ],
        activePersona: { name: 'TORI AI', id: 'tori' },
        conceptNodes: (result.concepts_found || []).map((concept: string, i: number) => ({
          id: `concept_${i}`,
          name: concept,
          position: { x: i, y: 0, z: 0 }
        })),
        loopId: `chat_${Date.now()}`,
        braidMetrics: { crossings: 0 },
        emergentConnections: [],
        holographicData: null
      };
      
    } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Enhanced API redirect failed:', error);
      return {
        response: `I apologize, but I encountered an error: ${msg
}`,
        newConcepts: [],
        confidence: 0.1,
        processingMethod: 'error',
        systemInsights: ['API connection failed'],
        activePersona: { name: 'Error', id: 'error' },
        conceptNodes: [],
        loopId: `error_${Date.now()}`,
        braidMetrics: { crossings: 0 },
        emergentConnections: [],
        holographicData: null
      };
    }
  }
};