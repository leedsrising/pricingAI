import axios from 'axios';

const API_URL = 'http://localhost:3001';

async function extractPricingInfo(url) {
  try {
    console.log('Extracting pricing info from URL:', url);
    const response = await axios.post(`${API_URL}/extract-pricing-info`, { url });
    console.log('Server response:', response.data);
    return response.data.pricingInfo;
  } catch (error) {
    console.error('Error extracting pricing information:', error);
    throw error;
  }
}

export default extractPricingInfo;