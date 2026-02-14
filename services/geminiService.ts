
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { GeneratedAsset, ImageSize, AspectRatio } from "../types";

// The API key is handled via process.env.API_KEY as per instructions
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getSystemInstruction = (productType: string) => `You are a world-class Print-on-Demand (POD) expert, Etsy SEO specialist, and intellectual property attorney.

YOUR OBJECTIVE:
Based on an image or an idea provided by the user (Invitation or T-shirt), you must generate a complete sales kit in English targeted at high-converting e-commerce platforms like Etsy and Shopify.

COPYRIGHT GOLDEN RULE:
If the input contains copyrighted elements (Brands, Disney, Marvel, Bands, Famous Characters), you MUST create an "Inspired by" design that is legally safe.
- Keep the concept, emotion, colors, and style.
- Remove logos, proper names, and exact faces.
- Transform specific elements into generic artistic archetypes.

VISUAL GOLDEN RULE (POD):
${productType === 'TSHIRT' ? `
- For T-shirts and Stickers, the design MUST be the raw artwork on a solid white background.
- ALWAYS add to the prompt: "isolated on white background", "No background", "Clean edges", "Vector style", "High contrast", "Professional graphic", "300 DPI print quality", "Ultra-detailed textures".
- NO mockups, NO models, NO hangers. Just the flat design.` : `
- For Invitation Cards, the design MUST be a standard 5x7 inch vertical or horizontal layout.
- The prompts should describe a complete, beautiful card layout including decorative borders or background patterns suitable for printing.
- Mention "5x7 inch layout", "high resolution 300 DPI print quality", "elegant typography placement", "Sharp focus".`}

STYLE DIVERSITY RULE:
Generate exactly 6 HIGHLY DISTINCT image prompts in ENGLISH to maximize Etsy conversion across different buyer personas. They should cover these 6 distinct styles:
1. Vintage Retro (70s/80s nostalgia)
2. Minimalist Line Art (Modern chic)
3. Hand-drawn Watercolor (Soft/Dreamy)
4. Bold Distressed Typography (Urban/Street)
5. Cyberpunk / Neon (Futuristic)
6. Boho Chic / Earthy (Nature/Organic)

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

| VARIATION | IMAGE PROMPT |
| :--- | :--- |
| 1 | [Prompt 1] |
| 2 | [Prompt 2] |
... and so on until 6 ...

---
**TITLE & SEO (Etsy/Google)**
**Main Title (140 chars):** [Optimized title with keywords first]
**Keywords (Tags):** [13 long-tail tags separated by commas]

---
**PRODUCT DESCRIPTION**
**Hook:** [Emotional hook]
**Details:** [Usage, aesthetic, and quality for ${productType === 'TSHIRT' ? 'T-shirt' : '5x7 Inch Invitation Card'}]
${productType === 'INVITATION' ? `
**CARD TEMPLATE TEXT:**
Join us for: [Event Name]
Date: [Date Placeholder]
Time: [Time Placeholder]
Location: [Address Placeholder]
RSVP to: [Contact Placeholder]` : ''}
**Why you'll love it:**
✅ [Benefit 1]
✅ [Benefit 2]
✅ [Benefit 3]`;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 5000, onRetry?: (msg: string) => void): Promise<T> {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status;
      const msg = error?.message || "";
      const isQuotaError = status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
      
      if (i < retries - 1 && (isQuotaError || status === 500)) {
        const waitTime = isQuotaError ? 75000 : currentDelay;
        if (onRetry) onRetry(isQuotaError ? "Rate limit hit. Cooling down for 75s..." : "Server busy. Retrying...");
        console.warn(`Quota Error hit. Attempt ${i + 1}. Cooling down for ${waitTime}ms...`);
        await sleep(waitTime);
        currentDelay *= 2; 
      } else {
        throw error;
      }
    }
  }
  throw new Error("Maximum retries reached due to API quota limits.");
}

export const generateKit = async (input: string, productType: string, options: { imageBase64?: string, thinkingMode?: boolean, fastMode?: boolean }): Promise<string> => {
  const parts: any[] = [{ text: `User Input: ${input}\nProduct Type: ${productType}` }];
  if (options.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: options.imageBase64.split(',')[1],
      },
    });
  }

  const model = options.thinkingMode ? 'gemini-3-pro-preview' : (options.fastMode ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview');
  
  const config: any = {
    systemInstruction: getSystemInstruction(productType),
    temperature: 1.0,
  };

  if (options.thinkingMode) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  const response: GenerateContentResponse = await withRetry(() => getAIClient().models.generateContent({
    model,
    contents: { parts },
    config,
  }), 3, 5000);

  return response.text || "Error generating the kit content.";
};

export const analyzeImage = async (imageBase64: string): Promise<string> => {
  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64.split(',')[1],
      },
    },
    { text: "Analyze this image for a Print-on-Demand business. What are the key visual elements, the target audience, and potential Etsy keywords?" },
  ];

  const response: GenerateContentResponse = await withRetry(() => getAIClient().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
  }), 2, 5000);

  return response.text || "Could not analyze image.";
};

export const editImageWithGemini = async (imageBase64: string, prompt: string): Promise<GeneratedAsset[]> => {
  const results: GeneratedAsset[] = [];
  
  // To satisfy "generate just 6 designs" for an edit
  for (let i = 0; i < 6; i++) {
    const parts: any[] = [
      {
        inlineData: {
          data: imageBase64.split(',')[1],
          mimeType: 'image/jpeg',
        },
      },
      { text: `${prompt}. Variation ${i + 1}. Ensure output is PNG format.` },
    ];

    try {
      const response: GenerateContentResponse = await withRetry(() => getAIClient().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      }), 2, 65000);

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            results.push({
              url: `data:image/png;base64,${part.inlineData.data}`,
              prompt: prompt
            });
            break;
          }
        }
      }
      if (i < 5) await sleep(45000); // Respect rate limit
    } catch (err) {
      console.error("Edit failed", err);
    }
  }
  
  return results;
};

export const generatePreviewImages = async (
  prompts: string[], 
  options: { 
    useHighQuality: boolean, 
    size?: ImageSize, 
    aspectRatio?: AspectRatio 
  },
  onAssetReady?: (asset: GeneratedAsset) => void,
  onCooldownStart?: (msg: string) => void
): Promise<GeneratedAsset[]> => {
  const results: GeneratedAsset[] = [];
  const modelName = options.useHighQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    try {
      const cleanPrompt = prompt.replace(/\*\*/g, '').replace(/\[|\]/g, '').trim();
      
      const config: any = {
        imageConfig: {
          aspectRatio: options.aspectRatio || "1:1",
        }
      };

      if (options.useHighQuality && options.size) {
        config.imageConfig.imageSize = options.size;
      }

      const response: GenerateContentResponse = await withRetry(() => getAIClient().models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: cleanPrompt }],
        },
        config
      }), 2, 65000, onCooldownStart); 

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const asset = {
              url: `data:image/png;base64,${part.inlineData.data}`,
              prompt: cleanPrompt
            };
            results.push(asset);
            onAssetReady?.(asset);
            break;
          }
        }
      }
    } catch (err) {
      console.error(`Skipping variation due to limit: ${prompt}`, err);
    }
    
    if (i < prompts.length - 1) {
      await sleep(45000); 
    }
  }

  return results;
};
