import React, { useState } from 'react';
import { database } from './firebase.js';
import { ref, push } from 'firebase/database';
import findPricingPage from './utils/findPricingPage.js';
import extractPricingInfo from './utils/extractPricingInfo.js';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [pricingUrl, setPricingUrl] = useState('');
  const [processedPricingInfo, setProcessedPricingInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setPricingUrl('');
    setProcessedPricingInfo(null);

    try {
      const foundPricingUrl = await findPricingPage(url);
      console.log('Found pricing URL:', foundPricingUrl);
      
      if (foundPricingUrl) {
        setPricingUrl(foundPricingUrl);
        let { processedPricingInfo, rawPricingInfo } = await extractPricingInfo(foundPricingUrl);
        setProcessedPricingInfo(processedPricingInfo);

        const urlsRef = ref(database, 'urls');
        const now = new Date();

        const firebasePayload = {
          inputUrl: url,
          pricingUrl: foundPricingUrl,
          rawPricingInfo,
          processedPricingInfo,
          readableDate: now.toLocaleString()
        };

        await push(urlsRef, firebasePayload);
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

  const renderPricingTable = () => {
    if (!processedPricingInfo || !processedPricingInfo.features || !processedPricingInfo.tiers) {
      return null;
    }

    return (
      <table className="pricing-table">
        <thead>
          <tr>
            <th>Features</th>
            {processedPricingInfo.tiers.map((tier, index) => (
              <th key={index}>{tier.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedPricingInfo.features.map((feature, index) => (
            <tr key={index}>
              <td>{feature}</td>
              {processedPricingInfo.tiers.map((tier, tierIndex) => (
                <td key={tierIndex}>{tier[feature] || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderPricingInfo = () => {
    if (!processedPricingInfo) {
      console.log('processedPricingInfo is null or undefined');
      return null;
    }

    console.log('Rendering pricing info:', JSON.stringify(processedPricingInfo, null, 2));

    if (processedPricingInfo.features && processedPricingInfo.tiers) {
      return renderPricingTable();
    } else if (processedPricingInfo.rawContent) {
      return (
        <div className="raw-content">
          <pre>{processedPricingInfo.rawContent}</pre>
        </div>
      );
    } else if (processedPricingInfo.error) {
      return <p>{processedPricingInfo.error}</p>;
    } else {
      return <p>Unable to extract structured pricing information.</p>;
    }
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
        {processedPricingInfo && (
          <div className="result">
            <h2>Extracted Pricing Information:</h2>
            {renderPricingInfo()}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
