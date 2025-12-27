import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
let openai = null;

if (apiKey) {
  openai = new OpenAI({ apiKey });
}

// Quick relevance check - returns true if ad is relevant to search keywords
export async function checkAdRelevance(adCopy, advertiser, searchKeywords) {
  if (!openai) {
    console.warn('OpenAI API key not set, skipping relevance check');
    return { relevant: true, reason: 'API key not configured' };
  }

  if (!adCopy || adCopy.length < 10) {
    return { relevant: true, reason: 'Too short to evaluate' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You determine if an ad is relevant to search keywords. Respond with JSON only: {"relevant": true/false, "reason": "brief reason"}'
        },
        {
          role: 'user',
          content: `Search keywords: "${searchKeywords}"
Advertiser: ${advertiser || 'Unknown'}
Ad text: "${adCopy.substring(0, 300)}"

Is this ad relevant to someone searching for "${searchKeywords}"? Consider industry, topic, and intent.`
        }
      ],
      temperature: 0.1,
      max_tokens: 100
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Relevance check error:', error.message);
    return { relevant: true, reason: 'Check failed, including ad' };
  }
}

const ANALYSIS_PROMPT = `You are an expert advertising analyst. Analyze the following ad copy and provide insights in JSON format.

Ad Copy:
"""
{AD_COPY}
"""

Advertiser: {ADVERTISER}
CTA: {CTA}

Provide your analysis in the following JSON format (no markdown, just pure JSON):
{
  "messagingTheme": "The core value proposition or main message (1-2 sentences)",
  "emotionalAppeal": "Primary emotional trigger being used (e.g., fear, aspiration, urgency, social proof, curiosity, exclusivity)",
  "targetAudience": "Who this ad is speaking to (demographics, pain points, desires)",
  "copywritingTechniques": ["List of techniques used", "e.g., scarcity", "social proof", "authority", "FOMO"],
  "hookAnalysis": "Analysis of how the ad grabs attention in the first line",
  "competitivePositioning": "How they differentiate from competitors (if apparent)",
  "suggestedImprovements": ["1-2 actionable suggestions to improve this ad"],
  "overallScore": 7,
  "scoreReasoning": "Brief explanation of the score (1-10 scale)"
}`;

export async function analyzeAd(ad) {
  if (!openai) {
    return { error: 'OpenAI API key not configured' };
  }

  const adCopy = ad.ad_copy || ad.adCopy || '';
  const advertiser = ad.advertiser_name || ad.advertiserName || 'Unknown';
  const cta = ad.cta_text || ad.ctaText || 'None';

  if (!adCopy || adCopy.length < 10) {
    return {
      error: 'Ad copy too short to analyze',
      messagingTheme: 'Unable to analyze - insufficient content',
      emotionalAppeal: 'Unknown',
      targetAudience: 'Unknown',
      copywritingTechniques: [],
      hookAnalysis: 'N/A',
      competitivePositioning: 'Unknown',
      suggestedImprovements: [],
      overallScore: 0,
      scoreReasoning: 'Insufficient content for analysis'
    };
  }

  const prompt = ANALYSIS_PROMPT
    .replace('{AD_COPY}', adCopy)
    .replace('{ADVERTISER}', advertiser)
    .replace('{CTA}', cta);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert advertising copywriter and analyst. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse JSON response
    try {
      // Remove any potential markdown code blocks
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(jsonStr);
      return analysis;
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        error: 'Failed to parse analysis',
        rawResponse: content
      };
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

export async function analyzeMultipleAds(ads) {
  const results = [];

  for (const ad of ads) {
    try {
      const analysis = await analyzeAd(ad);
      results.push({
        adId: ad.id,
        advertiser: ad.advertiser_name || ad.advertiserName,
        analysis
      });
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      results.push({
        adId: ad.id,
        advertiser: ad.advertiser_name || ad.advertiserName,
        error: error.message
      });
    }
  }

  return results;
}

export async function generateAggregateInsights(analyses) {
  if (!openai) {
    return { error: 'OpenAI API key not configured' };
  }

  const validAnalyses = analyses.filter(a => a.analysis && !a.analysis.error);

  if (validAnalyses.length === 0) {
    return { error: 'No valid analyses to aggregate' };
  }

  const summaryPrompt = `Based on analyzing ${validAnalyses.length} competitor ads, here are the individual insights:

${validAnalyses.map((a, i) => `
Ad ${i + 1} (${a.advertiser}):
- Theme: ${a.analysis.messagingTheme}
- Emotional Appeal: ${a.analysis.emotionalAppeal}
- Target: ${a.analysis.targetAudience}
- Techniques: ${a.analysis.copywritingTechniques?.join(', ')}
`).join('\n')}

Provide an aggregate analysis in JSON format:
{
  "dominantThemes": ["Most common messaging themes across all ads"],
  "emotionalAppealBreakdown": {"appeal_type": count},
  "audiencePatterns": "Common target audience characteristics",
  "topTechniques": ["Most frequently used copywriting techniques"],
  "competitiveLandscape": "Summary of how competitors are positioning themselves",
  "opportunityGaps": ["Areas where competitors are NOT focusing that could be opportunities"],
  "keyTakeaways": ["3-5 actionable insights for your own advertising"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert advertising strategist. Provide aggregate insights in valid JSON format only.'
        },
        {
          role: 'user',
          content: summaryPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Aggregate analysis error:', error);
    throw error;
  }
}
