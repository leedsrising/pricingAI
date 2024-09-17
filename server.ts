import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import puppeteer from 'puppeteer';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const IS_LOCAL_ENV = process.env.IS_LOCAL_ENV === 'true';

app.use(cors());
app.use(express.json());

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

app.post('/api/getPricing', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const pricingUrl = await findPricingPage(url);
    console.log('Found pricing URL:', pricingUrl);
    
    const pricingData = await extractPricingData(pricingUrl);
    res.status(200).json(pricingData);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: 'Error processing the request', details: error.message });
    } else {
      res.status(500).json({ error: 'Error processing the request', details: 'Unknown error' });
    }
  }
});

app.post('/api/getCompetitors', async (req, res) => {
  try {
    const { company } = req.body;
    if (!company) {
      return res.status(400).json({ error: 'Company URL is required' });
    }

    const competitors = await findCompetitors(company);
    res.status(200).json(competitors);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: 'Error processing the request', details: error.message });
    } else {
      res.status(500).json({ error: 'Error processing the request', details: 'Unknown error' });
    }
  }
});

async function findPricingPage(baseUrl: string): Promise<string> {
  const query = `${baseUrl} pricing`;
  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(searchUrl);
    const items = response.data.items;
    if (items && items.length > 0) {
      return items[0].link;
    } else {
      throw new Error('No pricing page found');
    }
  } catch (error) {
    console.error('Error finding pricing page:', error);
    throw error;
  }
}

async function extractPricingData(url: string): Promise<any> {
  let browser;
  try {
    console.log('Launching browser');
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true
    });
    console.log('Browser launched');

    console.log('Creating new page');
    const page = await browser.newPage();
    console.log('New page created');
    await page.setDefaultNavigationTimeout(100000); // extend timeout

    // Set a large viewport
    await page.setViewport({width: 1920, height: 1080});

    console.log('Navigating to URL');
    await page.goto(url, { waitUntil: 'networkidle0' });
    console.log('Navigation complete');
    
    // Scroll to bottom to ensure all content is loaded
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for any lazy-loaded content

    // Get the full height of the page
    const bodyHandle = await page.$('body');
    if (!bodyHandle) throw new Error('Unable to find body element');
    
    const boundingBox = await bodyHandle.boundingBox();
    if (!boundingBox) throw new Error('Unable to get bounding box');
    
    const height = boundingBox.height;
    await bodyHandle.dispose();

    // Set viewport to full page height
    await page.setViewport({width: 1920, height: Math.ceil(height)});

    // Take full page screenshot
    console.log('Taking screenshot');
    const screenshot = await page.screenshot({ fullPage: true });
    console.log('Screenshot taken');

    // if on local, save screenshot for easy QA
    if (IS_LOCAL_ENV) {
      const screenshotPath = path.join(__dirname, 'screenshot.png');
      fs.writeFileSync(screenshotPath, screenshot);
      console.log(`Full page screenshot saved at: ${screenshotPath}`);
    }

    const maxAttempts = 3;
    let attempt = 0;
    let pricingData;

    while (attempt < maxAttempts) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze the pricing information in this image. 
                Create a JSON object with the following strict format:
                [
                  {
                    "name": "Tier Name",
                    "price": "$/time period",
                  "features": ["Feature 1", "Feature 2", ...]
                  },
                  ...
                ]
                  
                Rules:
                1. Include all visible tiers.
                2. "features" should be a dictionary where each key is a distinct feature name using language from the pricing page. Units (millions, $, days) should be part of the value and not the feature name. The value is what that specific tier offers for the feature.
                3. any feature used as a key in one tier should be used as a key in all tiers, with the value being the feature's value in that tier.
                4. Do not include any marketing language or general descriptions.
                5. any value >1000 should use shorthand (i.e. 1K, 1M, 1B)
    
                Provide only the raw JSON object without any additional text, comments, or formatting.` 
                },
                { 
                  type: "image_url", 
                  image_url: { 
                    url: `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`
                  } 
                }
              ],
            },
          ],
        });

        const content = completion.choices[0].message.content;
        if (content !== null) {
          const parsedContent = JSON.parse(content);
          
          // Check if the parsed content matches the expected format
          if (isValidPricingData(parsedContent)) {
            pricingData = parsedContent.tiers || parsedContent;
            break;  // Exit the loop if valid data is found
          } else {
            console.log(parsedContent);
            console.log(`Attempt ${attempt + 1}: Invalid format, retrying...`);
          }
        }
      } catch (error) {
        console.error(`Error on attempt ${attempt + 1}:`, error);
      }

      attempt++;
    }

    if (!pricingData) {
      throw new Error('Failed to generate valid pricing data after multiple attempts');
    }

    console.log(pricingData)
    return pricingData;
    
  } catch (error) {
    console.error('Error extracting pricing information:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function isValidPricingData(data: any): boolean {
  // Check if data is an array or has a 'tiers' property that is an array
  const tiers = Array.isArray(data) ? data : data.tiers;
  
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return false;
  }

  // Check if each tier has the required properties
  return tiers.every(tier => 
    typeof tier.name === 'string' &&
    typeof tier.price === 'string' &&
    typeof tier.features === 'object' &&
    !Array.isArray(tier.features) &&
    Object.keys(tier.features).every(key => typeof key === 'string' && typeof tier.features[key] === 'string')
  );
}

async function findCompetitors(company: string): Promise<{ name: string; url: string }[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `List 3-5 close, direct competitors of ${company}.
        
        Return a JSON object with the following strict schema:
        [
          {
            "name": "Competitor Name",
            "url": "Primary Competitor homepage URL"
          },
          ...
        ]`
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  return content ? JSON.parse(content) : [];
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});