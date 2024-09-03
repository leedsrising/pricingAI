import axios from 'axios';

const API_URL = 'http://localhost:3001';

async function findPricingPage(domain) {
  try {
    console.log('API_URL:', API_URL);
    const response = await axios.post(`${API_URL}/find-pricing-page`, { domain });
    console.log('Server response:', response.data);
    return response.data.pricingUrl;
  } catch (error) {
    console.error('Error finding pricing page:', error);
    throw error;
  }
}

export default findPricingPage;