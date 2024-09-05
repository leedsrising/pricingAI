import axios from 'axios';

const API_URL = 'http://localhost:3001';

async function extractPricingInfo(url) {
  try {
    console.log('Extracting pricing info from URL:', url);
    const response = await axios.post(`${API_URL}/extract-pricing-info`, { url });
    console.log('Server response:', JSON.stringify(response.data, null, 2));

    // The pricing info is directly in response.data.pricingInfo
    const processedPricingInfo = response.data.pricingInfo;
    const rawPricingInfo = JSON.stringify(processedPricingInfo);

    console.log('Processed pricing info:', JSON.stringify(processedPricingInfo, null, 2));

    return { processedPricingInfo, rawPricingInfo };
  } catch (error) {
    console.error('Error extracting pricing information:', error);
    return { 
      processedPricingInfo: { error: 'Failed to extract pricing information' }, 
      rawPricingInfo: '' 
    };
  }
}

export default extractPricingInfo;