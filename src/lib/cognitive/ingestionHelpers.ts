/**
 * 🧬 Enhanced Ingestion Pipeline Helper
 * 
 * This module provides TypeScript bindings to call the enhanced Python pipeline
 * from the ScholarSphere upload system.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';

export interface EnhancedIngestionResult {
  success: boolean;
  filename: string;
  concept_count: number;
  concept_names: string[];
  semantic_concepts: number;
  boosted_concepts: number;
  score_boosted_concepts: number;
  processing_time_seconds: number;
  extraction_threshold: number;
  average_score: number;
  high_confidence_concepts: number;
  concept_mesh_injected: boolean;
  extraction_method: string;
  status: string;
  error_message?: string;
}

/**
 * 🧬 Run Enhanced Python Ingestion Pipeline
 * 
 * Routes the uploaded file through our enhanced Python pipeline with:
 * - Surgical debug semantic extraction
 * - Database concept boosting  
 * - Zero threshold filtering
 * - ConceptMesh integration
 */
export async function runEnhancedIngestPipeline(
  fileBuffer: ArrayBuffer,
  filename: string,
  extractionThreshold: number = 0.0
): Promise<EnhancedIngestionResult> {
  
  console.log('🧬 Starting Enhanced Python Pipeline Integration');
  console.log('🔧 File:', filename, 'Threshold:', extractionThreshold);
  
  // Create temporary file for Python processing
  const tempDir = join(process.cwd(), 'temp');
  const tempFilePath = join(tempDir, `temp_${Date.now()}_${filename}`);
  
  try {
    // Ensure temp directory exists
    await import('fs').then(fs => {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    });
    
    // Write file to temp location
    await writeFile(tempFilePath, new Uint8Array(fileBuffer));
    console.log('📁 Temp file created:', tempFilePath);
    
    // Call enhanced Python pipeline
    const result = await callPythonPipeline(tempFilePath, extractionThreshold);
    
    // Clean up temp file
    await unlink(tempFilePath);
    console.log('🧹 Temp file cleaned up');
    
    return result;
    
  } catch (error: any) {
    // Clean up temp file on error
    try {
      await unlink(tempFilePath);
    } catch (cleanupError) {
  const msg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      console.warn('Failed to clean up temp file:', cleanupError);
    
}
    
    console.error('🚨 Enhanced pipeline failed:', error);
    
    return {
      success: false,
      filename,
      concept_count: 0,
      concept_names: [],
      semantic_concepts: 0,
      boosted_concepts: 0,
      score_boosted_concepts: 0,
      processing_time_seconds: 0,
      extraction_threshold: extractionThreshold,
      average_score: 0,
      high_confidence_concepts: 0,
      concept_mesh_injected: false,
      extraction_method: 'enhanced_python_pipeline',
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🐍 Call Python Enhanced Pipeline
 */
async function callPythonPipeline(
  filePath: string, 
  threshold: number
): Promise<EnhancedIngestionResult> {
  
  return new Promise((resolve, reject) => {
    console.log('🐍 Spawning Python enhanced pipeline process');
    
    // Path to Python script
    const pythonScript = join(process.cwd(), '..', 'demo_enhanced_pipeline.py');
    const args = [pythonScript, filePath, '--threshold', threshold.toString()];
    
    console.log('🐍 Python command:', 'python', args.join(' '));
    
    const pythonProcess = spawn('python', args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('🐍 Python stdout:', output);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log('🐍 Python stderr:', output);
    });
    
    pythonProcess.on('close', (code) => {
      console.log('🐍 Python process finished with code:', code);
      
      if (code === 0) {
        // Parse results from stdout
        try {
          const result = parsePythonOutput(stdout);
          console.log('✅ Python pipeline success:', result);
          resolve(result);
        } catch (parseError) {
  const msg = parseError instanceof Error ? parseError.message : String(parseError);
          console.error('Failed to parse Python output:', parseError);
          reject(new Error(`Failed to parse Python output: ${parseError
}`));
        }
      } else {
        console.error('🚨 Python pipeline failed with code:', code);
        console.error('🚨 stderr:', stderr);
        reject(new Error(`Python process failed with code ${code}: ${stderr}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('🚨 Failed to spawn Python process:', error);
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
    
    // Set timeout
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Python pipeline timeout after 60 seconds'));
    }, 60000);
  });
}

/**
 * 📊 Parse Python Pipeline Output
 */
function parsePythonOutput(stdout: string): EnhancedIngestionResult {
  console.log('📊 Parsing Python output...');
  
  // Look for result patterns in stdout
  const lines = stdout.split('\n');
  
  let conceptCount = 0;
  let semanticConcepts = 0;
  let boostedConcepts = 0;
  let scoreBoostedConcepts = 0;
  let processingTime = 0;
  let averageScore = 0;
  let highConfidenceConcepts = 0;
  let conceptNames: string[] = [];
  let extractionMethod = 'enhanced_python_pipeline';
  let status = 'success';
  
  // Parse key metrics from logs
  for (const line of lines) {
    if (line.includes('Total Concepts:')) {
      const match = line.match(/Total Concepts:\s*(\d+)/);
      if (match) conceptCount = parseInt(match[1]);
    }
    
    if (line.includes('Semantic Concepts:')) {
      const match = line.match(/Semantic Concepts:\s*(\d+)/);
      if (match) semanticConcepts = parseInt(match[1]);
    }
    
    if (line.includes('Database Boosted:')) {
      const match = line.match(/Database Boosted:\s*(\d+)/);
      if (match) boostedConcepts = parseInt(match[1]);
    }
    
    if (line.includes('Score Boosted:')) {
      const match = line.match(/Score Boosted:\s*(\d+)/);
      if (match) scoreBoostedConcepts = parseInt(match[1]);
    }
    
    if (line.includes('Processing Time:')) {
      const match = line.match(/Processing Time:\s*([\d.]+)s/);
      if (match) processingTime = parseFloat(match[1]);
    }
    
    if (line.includes('Average Score:')) {
      const match = line.match(/Average Score:\s*([\d.]+)/);
      if (match) averageScore = parseFloat(match[1]);
    }
    
    if (line.includes('High Confidence')) {
      const match = line.match(/High Confidence[^:]*:\s*(\d+)/);
      if (match) highConfidenceConcepts = parseInt(match[1]);
    }
    
    // Extract concept names (look for numbered lists)
    const conceptMatch = line.match(/^\s*\d+\.\s*(.+)$/);
    if (conceptMatch && !line.includes('Processing') && !line.includes('chunk')) {
      conceptNames.push(conceptMatch[1].trim());
    }
  }
  
  console.log('📊 Parsed results:', {
    conceptCount,
    semanticConcepts,
    boostedConcepts,
    scoreBoostedConcepts,
    conceptNames: conceptNames.slice(0, 5) // Log first 5
  });
  
  return {
    success: true,
    filename: '', // Will be set by caller
    concept_count: conceptCount,
    concept_names: conceptNames,
    semantic_concepts: semanticConcepts,
    boosted_concepts: boostedConcepts,
    score_boosted_concepts: scoreBoostedConcepts,
    processing_time_seconds: processingTime,
    extraction_threshold: 0.0,
    average_score: averageScore,
    high_confidence_concepts: highConfidenceConcepts,
    concept_mesh_injected: true,
    extraction_method: extractionMethod,
    status: status
  };
}

/**
 * 🧠 Alternative: Direct Python Module Import (if available)
 * 
 * For environments where Python modules can be imported directly
 */
export async function runEnhancedIngestPipelineDirect(
  filePath: string,
  extractionThreshold: number = 0.0
): Promise<EnhancedIngestionResult> {
  
  try {
    console.log('🧬 Attempting direct Python module import');
    
    // This would require python-shell or similar package
    // const { PythonShell } = require('python-shell');
    
    // For now, fall back to subprocess approach
    console.log('🔄 Direct import not available, using subprocess');
    return runEnhancedIngestPipeline(new ArrayBuffer(0), '', extractionThreshold);
    
  } catch (error: any) {
    console.error('Direct Python import failed:', error);
    throw error;
  }
}

/**
 * 🔍 Test Python Pipeline Connection
 */
export async function testPythonPipelineConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing Python pipeline connection...');
    
    const testProcess = spawn('python', ['-c', 'print("Python available")'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return new Promise((resolve) => {
      testProcess.on('close', (code) => {
        const available = code === 0;
        console.log('🔍 Python pipeline available:', available);
        resolve(available);
      });
      
      testProcess.on('error', () => {
        console.log('🔍 Python pipeline not available');
        resolve(false);
      });
      
      setTimeout(() => {
        testProcess.kill();
        resolve(false);
      }, 5000);
    });
    
  } catch (error: any) {
    console.log('🔍 Python pipeline test failed:', error);
    return false;
  }
}

console.log('🧬 Enhanced ingestion pipeline helper loaded');
