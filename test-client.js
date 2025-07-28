#!/usr/bin/env node

/**
 * Simple test client for the Oracle MCP Server
 * This demonstrates how to interact with the MCP server programmatically
 */

import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

class MCPTestClient {
  constructor() {
    this.requestId = 1;
  }

  async startServer() {
    this.serverProcess = spawn('node', ['oracle-mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.log('Server stderr:', data.toString());
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    const requestStr = JSON.stringify(request) + '\n';
    console.log('Sending request:', requestStr.trim());

    this.serverProcess.stdin.write(requestStr);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const onData = (data) => {
        clearTimeout(timeout);
        this.serverProcess.stdout.removeListener('data', onData);
        try {
          const response = JSON.parse(data.toString().trim());
          console.log('Received response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      this.serverProcess.stdout.on('data', onData);
    });
  }

  async testListTools() {
    console.log('\n=== Testing List Tools ===');
    try {
      const response = await this.sendRequest('tools/list');
      console.log('Available tools:', response.result?.tools?.map(t => t.name));
    } catch (error) {
      console.error('Error listing tools:', error.message);
    }
  }

  async testGetConnectionInfo() {
    console.log('\n=== Testing Get Connection Info ===');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'get_connection_info',
        arguments: {}
      });
      console.log('Connection info retrieved successfully');
    } catch (error) {
      console.error('Error getting connection info:', error.message);
    }
  }

  async testListTables() {
    console.log('\n=== Testing List Tables ===');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'list_tables',
        arguments: {}
      });
      console.log('Tables listed successfully');
    } catch (error) {
      console.error('Error listing tables:', error.message);
    }
  }

  async testQuery() {
    console.log('\n=== Testing Query Execution ===');
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'execute_query',
        arguments: {
          query: 'SELECT USER FROM DUAL'
        }
      });
      console.log('Query executed successfully');
    } catch (error) {
      console.error('Error executing query:', error.message);
    }
  }

  async runTests() {
    try {
      console.log('Starting Oracle MCP Server tests...');
      
      await this.startServer();
      
      await this.testListTools();
      await this.testGetConnectionInfo();
      await this.testListTables();
      await this.testQuery();
      
      console.log('\n=== All tests completed ===');
    } catch (error) {
      console.error('Test failed:', error.message);
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
    }
  }

  stopServer() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new MCPTestClient();
  
  process.on('SIGINT', () => {
    console.log('\nStopping test client...');
    client.stopServer();
    process.exit(0);
  });
  
  client.runTests().catch(console.error);
}

export default MCPTestClient;