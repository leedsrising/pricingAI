import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import puppeteer from 'puppeteer';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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
    res.status(200).json({ pricingData });
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
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(100000); // extend timeout
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    const screenshot = await page.screenshot({ encoding: 'base64' });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Return a cropped image that only captures the primary pricing table or pricing information." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${screenshot}` } }
          ],
        },
      ],
      max_tokens: 4096,
    });

    console.log('OpenAI API response received');
    let pricingData;
    try {
      const content = completion.choices[0].message.content;
      if (content !== null) {
        pricingData = JSON.parse(content);
      } else {
        console.error('Content is null');
      }
    } catch (jsonError) {
      console.error('Error parsing JSON:', jsonError);
      pricingData = { rawContent: completion.choices[0].message.content };
    }
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});