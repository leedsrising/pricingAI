require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require("openai");  // Updated import
const rateLimit = require('express-rate-limit');
const cheerio = require('cheerio'); // You'll need to install this: npm install cheerio

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
    const response = await axios.get(url);
    const htmlContent = response.data;
    console.log('Successfully fetched HTML content');

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {role: "system", content: "You are a helpful assistant that extracts pricing information from web pages."},
          {role: "user", content: `Extract all relevant pricing information from this HTML content: ${htmlContent}`}
        ],
      });

      console.log('OpenAI API response received');
      res.json({ pricingInfo: completion.choices[0].message.content });
    } catch (openaiError) {
      console.error('OpenAI API error, falling back to simple extraction:', openaiError.message);
      const $ = cheerio.load(htmlContent);
      const simplePricingInfo = $('body').text().substring(0, 1000); // Get first 1000 characters of body text
      res.json({ pricingInfo: simplePricingInfo, fallback: true });
    }
  } catch (error) {
    console.error('Error extracting pricing information:', error.message);
    if (error.response && error.response.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else {
      res.status(500).json({ error: 'Error extracting pricing information', details: error.message });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));