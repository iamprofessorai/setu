
import { Exa } from 'exa-js';
import dotenv from 'dotenv';

dotenv.config();

async function findEndpoint() {
  const exa = new Exa(process.env.EXA_API_KEY);
  
  console.log("Searching for IndianAPI.in market live data endpoint...");
  
  try {
    const result = await exa.searchAndContents(
      "IndianAPI.in stock market live data endpoint URL documentation",
      {
        numResults: 5,
        useAutoprompt: true
      }
    );
    
    for (const res of result.results) {
      console.log(`--- Source: ${res.title} (${res.url}) ---`);
      console.log(res.text.substring(0, 1000));
      console.log("\n");
    }
  } catch (e) {
    console.error("Exa Search Error:", e.message);
  }
}

findEndpoint();
