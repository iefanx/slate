// On-Device Vector Similarity Engine (TF-IDF & Cosine Similarity in pure JS)

// List of English stop words to filter out common syntactic noise
const STOP_WORDS = new Set([
  'the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'on', 'with', 
  'as', 'at', 'by', 'an', 'be', 'this', 'are', 'from', 'or', 'you', 'your', 'i', 
  'my', 'we', 'they', 'he', 'she', 'was', 'were', 'but', 'not', 'have', 'has', 
  'had', 'do', 'does', 'did', 'been', 'about', 'what', 'which', 'who', 'how',
  'where', 'when', 'why', 'can', 'will', 'would', 'should', 'could', 'me', 'them',
  'him', 'her', 'us', 'our', 'their', 'there', 'here'
]);

// Helper: Tokenize text into lowercased terms, excluding stop words and single characters
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Strip punctuation except hyphens
    .split(/[\s_]+/) // Split on spaces or underscores
    .map(term => term.trim())
    .filter(term => term.length > 1 && !STOP_WORDS.has(term));
}

// Interface for Term Frequencies in a document
interface TermFrequencies {
  [term: string]: number;
}

// Calculate Term Frequencies (TF) for a tokenized list
function getTermFrequencies(tokens: string[]): TermFrequencies {
  const tf: TermFrequencies = {};
  if (tokens.length === 0) return tf;
  
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  
  // Normalize by dividing by total tokens
  for (const token in tf) {
    tf[token] = tf[token] / tokens.length;
  }
  
  return tf;
}

// Interface for a precalculated vector profile
export interface DocumentVector {
  id: string;
  terms: TermFrequencies;
  magnitude: number;
}

// Perform a full TF-IDF similarity query comparing a draft against a set of historical documents
export function findSimilarNotes(
  activeDraft: string,
  history: { id: string; content: string }[],
  minScore = 0.25
): { id: string; score: number }[] {
  const activeTokens = tokenize(activeDraft);
  if (activeTokens.length === 0 || history.length === 0) return [];

  const activeTf = getTermFrequencies(activeTokens);

  // 1. Gather all documents (active + history) for IDF calculation
  const allDocs = [
    { id: 'active', tokens: activeTokens, tf: activeTf },
    ...history.map(doc => {
      const tokens = tokenize(doc.content);
      return { id: doc.id, tokens, tf: getTermFrequencies(tokens) };
    })
  ];

  const totalDocuments = allDocs.length;

  // 2. Compute Inverse Document Frequency (IDF) for each unique term
  const termDocCounts: { [term: string]: number } = {};
  for (const doc of allDocs) {
    const uniqueTerms = new Set(doc.tokens);
    for (const term of uniqueTerms) {
      termDocCounts[term] = (termDocCounts[term] || 0) + 1;
    }
  }

  const idfs: { [term: string]: number } = {};
  for (const term in termDocCounts) {
    // IDF = ln(1 + TotalDocs / DocsWithTerm)
    idfs[term] = Math.log(1 + totalDocuments / termDocCounts[term]);
  }

  // 3. Compute TF-IDF Vectors for all documents
  const tfIdfVectors = allDocs.map(doc => {
    const vector: { [term: string]: number } = {};
    let sumSquares = 0;

    for (const term in doc.tf) {
      const tfIdf = doc.tf[term] * (idfs[term] || 0);
      vector[term] = tfIdf;
      sumSquares += tfIdf * tfIdf;
    }

    const magnitude = Math.sqrt(sumSquares);

    return {
      id: doc.id,
      vector,
      magnitude
    };
  });

  const activeVectorProfile = tfIdfVectors.find(v => v.id === 'active')!;
  const results: { id: string; score: number }[] = [];

  // 4. Calculate Cosine Similarity against each historical document vector
  for (const docProfile of tfIdfVectors) {
    if (docProfile.id === 'active') continue;

    // A = Active Vector, B = History Doc Vector
    // DotProduct = sum(A_i * B_i)
    let dotProduct = 0;
    const a = activeVectorProfile.vector;
    const b = docProfile.vector;

    for (const term in a) {
      if (b[term]) {
        dotProduct += a[term] * b[term];
      }
    }

    const magnitudeProduct = activeVectorProfile.magnitude * docProfile.magnitude;
    const score = magnitudeProduct > 0 ? dotProduct / magnitudeProduct : 0;

    if (score >= minScore) {
      results.push({
        id: docProfile.id,
        score: Math.min(1, Math.max(0, score)) // Clamp between 0 and 1
      });
    }
  }

  // Sort by highest score first
  return results.sort((a, b) => b.score - a.score);
}
