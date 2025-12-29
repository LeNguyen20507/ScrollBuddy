// MCP Client Handler - Brave Search API + Local Filesystem
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MCPHandler {
  constructor() {
    this.dataPath = path.resolve(__dirname, '..', process.env.DATA_PATH || '.scrollbuddy');
  }

  // Direct Brave Search API call
  async webSearch(query, count = 5) {
    try {
      const apiKey = process.env.BRAVE_API_KEY;
      if (!apiKey) {
        console.error("❌ BRAVE_API_KEY not set");
        return { web: { results: [] } };
      }

      console.log("🔍 Searching Brave for:", query.substring(0, 50) + "...");

      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        },
        params: {
          q: query,
          count: count,
          text_decorations: false,
          search_lang: 'en'
        }
      });

      const results = response.data?.web?.results || [];
      console.log("✅ Brave Search found:", results.length, "results");
      
      // Log first result for debugging
      if (results.length > 0) {
        console.log("   First result:", results[0].title?.substring(0, 50));
      }
      
      return { web: { results } };
    } catch (error) {
      console.error("❌ Brave Search error:", error.response?.data || error.message);
      return { web: { results: [] } };
    }
  }

  // Direct filesystem operations
  async readFile(filePath) {
    try {
      const fullPath = path.resolve(this.dataPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error("❌ Read file error:", error.message);
      }
      return null;
    }
  }

  async writeFile(filePath, content) {
    try {
      const fullPath = path.resolve(this.dataPath, filePath);
      const dir = path.dirname(fullPath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error("❌ Write file error:", error.message);
      return false;
    }
  }

  // Save fact-check to history
  async saveFactCheck(factCheck) {
    try {
      const historyPath = 'fact-checks/history.json';
      let history = [];
      
      const existing = await this.readFile(historyPath);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          history = parsed.factChecks || [];
        } catch {
          history = [];
        }
      }

      history.unshift({
        ...factCheck,
        id: Date.now(),
        timestamp: new Date().toISOString()
      });

      // Keep only last 100 entries
      history = history.slice(0, 100);

      await this.writeFile(historyPath, JSON.stringify({ factChecks: history }, null, 2));
      console.log("✅ Fact-check saved to history");
      
      return true;
    } catch (error) {
      console.error("❌ Save fact-check error:", error.message);
      return false;
    }
  }

  // Get fact-check history
  async getHistory() {
    try {
      const historyPath = 'fact-checks/history.json';
      const content = await this.readFile(historyPath);
      
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.factChecks || [];
      }
      
      return [];
    } catch (error) {
      console.error("❌ Get history error:", error.message);
      return [];
    }
  }

  // Cleanup (kept for compatibility)
  async disconnect() {
    console.log("✅ Handler cleanup complete");
  }
}

// Export singleton instance
export const mcpHandler = new MCPHandler();
export default mcpHandler;
