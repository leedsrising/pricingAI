import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { OpenAI } from "openai";
import rateLimit from 'express-rate-limit';
import puppeteer from 'puppeteer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Create a limiter: max 5 requests per minute
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5 // limit each IP to 5 requests per windowMs
});

// Apply rate limiter to all requests
app.use(limiter);

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;

// Updated OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/find-pricing-page', async (req, res) => {
  const { domain } = req.body;
  console.log(`Searching for pricing page for domain: ${domain}`);
  try {
    const searchResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CX,
        q: `${domain} pricing`,
      }
    });

    console.log('Google API response:', JSON.stringify(searchResponse.data, null, 2));

    if (searchResponse.data.items && searchResponse.data.items.length > 0) {
      const pricingUrl = searchResponse.data.items[0].link;
      console.log(`Found pricing URL: ${pricingUrl}`);
      res.json({ pricingUrl });
    } else {
      console.log('No pricing page found');
      res.json({ pricingUrl: null });
    }
  } catch (error) {
    console.error('Error using Google Custom Search API:', error);
    res.status(500).json({ error: 'Error finding pricing page' });
  }
});

app.post('/extract-pricing-info', async (req, res) => {
  const { url } = req.body;
  try {
    console.log('Received request to extract pricing info from:', url);
    
    // Launch a headless browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Navigate to the URL and wait for the content to load
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Take a screenshot
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    await browser.close();

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract basic pricing including tiers, features, and how pricing scales from this image of a pricing page." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${screenshot}` } }
            ],
          },
        ],
      });

      console.log('OpenAI API response received');
      res.json({ pricingInfo: completion.choices[0].message.content });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError.message);
      res.status(500).json({ error: 'Error processing the image', details: openaiError.message });
    }
  } catch (error) {
    console.error('Error extracting pricing information:', error.message);
    res.status(500).json({ error: 'Error extracting pricing information', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));