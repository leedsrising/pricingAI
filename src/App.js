import React, { useState } from 'react';
import { database } from './firebase.js';
import { ref, push } from 'firebase/database';
import findPricingPage from './utils/findPricingPage.js';
import extractPricingInfo from './utils/extractPricingInfo.js';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [pricingUrl, setPricingUrl] = useState('');
  const [pricingInfo, setPricingInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setPricingUrl('');
    setPricingInfo('');

    try {
      const foundPricingUrl = await findPricingPage(url);
      console.log('Found pricing URL:', foundPricingUrl);
      
      if (foundPricingUrl) {
        setPricingUrl(foundPricingUrl);
        let extractedInfo = ''
        try {
          extractedInfo = await extractPricingInfo(foundPricingUrl); // Remove 'const'
          setPricingInfo(extractedInfo || 'Unable to extract pricing information');
        } catch (extractError) {
          console.error('Error extracting pricing info:', extractError);
          setPricingInfo('Error extracting pricing information');
          extractedInfo = 'Error extracting pricing information';
        }

        const urlsRef = ref(database, 'urls');
        const now = new Date();
        push(urlsRef, {
          inputUrl: url,
          pricingUrl: foundPricingUrl,
          pricingInfo: extractedInfo,
          readableDate: now.toLocaleString()
        });
      } else {
        setPricingUrl('No pricing page found');
      }
    } catch (error) {
      console.error('Error:', error);
      setPricingUrl('Error finding pricing page');
    } finally {
      setIsLoading(false);
    }

    setUrl('');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>pricing.ai</h1>
        <form onSubmit={handleSubmit} className="url-input-container">
          <input
            type="text"
            placeholder="Enter company domain (e.g., alchemy.com)"
            className="url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Submit'}
          </button>
        </form>
        {pricingUrl && (
          <div className="result">
            <h2>Pricing Page:</h2>
            <p>{pricingUrl}</p>
          </div>
        )}
        {pricingInfo && (
          <div className="result">
            <h2>Extracted Pricing Information:</h2>
            <p>{pricingInfo}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
