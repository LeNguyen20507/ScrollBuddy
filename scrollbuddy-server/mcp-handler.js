// MCP Client Handler - Brave Search + Filesystem
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

class MCPHandler {
  constructor() {
    this.braveClient = null;
    this.filesystemClient = null;
    this.isConnected = false;
  }

  // Initialize Brave Search MCP client
  async initBraveSearch() {
    if (this.braveClient) return this.braveClient;

    try {
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-brave-search"],
        env: { 
          ...process.env,
          BRAVE_API_KEY: process.env.BRAVE_API_KEY 
        }
      });

      this.braveClient = new Client({
        name: "scrollbuddy-brave",
        version: "1.0.0"
      });

      await this.braveClient.connect(transport);
      console.log("✅ Brave Search MCP connected");
      return this.braveClient;
    } catch (error) {
      console.error("❌ Failed to connect Brave Search MCP:", error.message);
      throw error;
    }
  }

  // Initialize Filesystem MCP client
  async initFilesystem() {
    if (this.filesystemClient) return this.filesystemClient;

    try {
      const dataPath = process.env.DATA_PATH || '.scrollbuddy';
      
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", dataPath],
        env: process.env
      });

      this.filesystemClient = new Client({
        name: "scrollbuddy-filesystem",
        version: "1.0.0"
      });

      await this.filesystemClient.connect(transport);
      console.log("✅ Filesystem MCP connected");
      return this.filesystemClient;
    } catch (error) {
      console.error("❌ Failed to connect Filesystem MCP:", error.message);
      throw error;
    }
  }

  // Search the web using Brave Search
  async webSearch(query, count = 5) {
    try {
      const client = await this.initBraveSearch();
      
      const result = await client.callTool({
        name: "brave_web_search",
        arguments: { 
          query: query,
          count: count
        }
      });

      // Parse the result
      if (result && result.content && result.content[0]) {
        const textContent = result.content[0].text;
        try {
          return JSON.parse(textContent);
        } catch {
          return { raw: textContent };
        }
      }
      
      return result;
    } catch (error) {
      console.error("❌ Brave search error:", error.message);
      throw error;
    }
  }

  // Read file using Filesystem MCP
  async readFile(filePath) {
    try {
      const client = await this.initFilesystem();
      
      const result = await client.callTool({
        name: "read_file",
        arguments: { path: filePath }
      });

      if (result && result.content && result.content[0]) {
        return result.content[0].text;
      }
      
      return null;
    } catch (error) {
      console.error("❌ Read file error:", error.message);
      throw error;
    }
  }

  // Write file using Filesystem MCP
  async writeFile(filePath, content) {
    try {
      const client = await this.initFilesystem();
      
      const result = await client.callTool({
        name: "write_file",
        arguments: { 
          path: filePath,
          content: content
        }
      });

      return result;
    } catch (error) {
      console.error("❌ Write file error:", error.message);
      throw error;
    }
  }

  // Save fact-check to history
  async saveFactCheck(factCheck) {
    try {
      const historyPath = 'fact-checks/history.json';
      let history = [];
      
      try {
        const existing = await this.readFile(historyPath);
        if (existing) {
          const parsed = JSON.parse(existing);
          history = parsed.factChecks || [];
        }
      } catch {
        // File doesn't exist yet, start fresh
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

  // Cleanup connections
  async disconnect() {
    try {
      if (this.braveClient) {
        await this.braveClient.close();
        this.braveClient = null;
      }
      if (this.filesystemClient) {
        await this.filesystemClient.close();
        this.filesystemClient = null;
      }
      console.log("✅ MCP clients disconnected");
    } catch (error) {
      console.error("❌ Disconnect error:", error.message);
    }
  }
}

// Export singleton instance
export const mcpHandler = new MCPHandler();
export default mcpHandler;
