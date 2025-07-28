#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import oracledb from 'oracledb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Oracle database configuration
const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
};

// Initialize Oracle client
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

class OracleMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'oracle-mcp-server',
        version: process.env.MCP_SERVER_VERSION || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_query',
            description: 'Execute a SELECT query on the Oracle database',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The SQL SELECT query to execute',
                },
                binds: {
                  type: 'array',
                  description: 'Optional bind parameters for the query',
                  items: {
                    type: 'string'
                  }
                }
              },
              required: ['query'],
            },
          },
          {
            name: 'execute_dml',
            description: 'Execute DML operations (INSERT, UPDATE, DELETE) on the Oracle database',
            inputSchema: {
              type: 'object',
              properties: {
                statement: {
                  type: 'string',
                  description: 'The SQL DML statement to execute',
                },
                binds: {
                  type: 'array',
                  description: 'Optional bind parameters for the statement',
                  items: {
                    type: 'string'
                  }
                }
              },
              required: ['statement'],
            },
          },
          {
            name: 'describe_table',
            description: 'Get the structure/schema of a table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'The name of the table to describe',
                },
                schema: {
                  type: 'string',
                  description: 'Optional schema name (defaults to current user)',
                }
              },
              required: ['table_name'],
            },
          },
          {
            name: 'list_tables',
            description: 'List all tables accessible to the current user',
            inputSchema: {
              type: 'object',
              properties: {
                schema: {
                  type: 'string',
                  description: 'Optional schema name to filter tables',
                }
              },
            },
          },
          {
            name: 'get_connection_info',
            description: 'Get information about the current database connection',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_query':
            return await this.executeQuery(args.query, args.binds);
          case 'execute_dml':
            return await this.executeDML(args.statement, args.binds);
          case 'describe_table':
            return await this.describeTable(args.table_name, args.schema);
          case 'list_tables':
            return await this.listTables(args.schema);
          case 'get_connection_info':
            return await this.getConnectionInfo();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Database operation failed: ${error.message}`
        );
      }
    });
  }

  async getConnection() {
    try {
      return await oracledb.getConnection(dbConfig);
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to connect to Oracle database: ${error.message}`
      );
    }
  }

  async executeQuery(query, binds = []) {
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Only SELECT queries are allowed with execute_query tool'
      );
    }

    let connection;
    try {
      connection = await this.getConnection();
      const result = await connection.execute(query, binds);
      
      return {
        content: [
          {
            type: 'text',
            text: `Query executed successfully. Returned ${result.rows.length} rows.\n\nResults:\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async executeDML(statement, binds = []) {
    const upperStatement = statement.trim().toUpperCase();
    if (!upperStatement.startsWith('INSERT') && 
        !upperStatement.startsWith('UPDATE') && 
        !upperStatement.startsWith('DELETE')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Only INSERT, UPDATE, and DELETE statements are allowed with execute_dml tool'
      );
    }

    let connection;
    try {
      connection = await this.getConnection();
      const result = await connection.execute(statement, binds);
      
      return {
        content: [
          {
            type: 'text',
            text: `DML statement executed successfully. ${result.rowsAffected} rows affected.`,
          },
        ],
      };
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async describeTable(tableName, schema) {
    let connection;
    try {
      connection = await this.getConnection();
      
      const query = schema 
        ? `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, DATA_DEFAULT 
           FROM ALL_TAB_COLUMNS 
           WHERE TABLE_NAME = UPPER(:tableName) AND OWNER = UPPER(:schema) 
           ORDER BY COLUMN_ID`
        : `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, DATA_DEFAULT 
           FROM USER_TAB_COLUMNS 
           WHERE TABLE_NAME = UPPER(:tableName) 
           ORDER BY COLUMN_ID`;
      
      const binds = schema ? [tableName, schema] : [tableName];
      const result = await connection.execute(query, binds);
      
      if (result.rows.length === 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Table '${tableName}' not found${schema ? ` in schema '${schema}'` : ''}`
        );
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Table structure for ${schema ? schema + '.' : ''}${tableName}:\n\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async listTables(schema) {
    let connection;
    try {
      connection = await this.getConnection();
      
      const query = schema 
        ? `SELECT TABLE_NAME, OWNER FROM ALL_TABLES WHERE OWNER = UPPER(:schema) ORDER BY TABLE_NAME`
        : `SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME`;
      
      const binds = schema ? [schema] : [];
      const result = await connection.execute(query, binds);
      
      return {
        content: [
          {
            type: 'text',
            text: `Tables${schema ? ` in schema '${schema}'` : ''}:\n\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async getConnectionInfo() {
    let connection;
    try {
      connection = await this.getConnection();
      
      const queries = [
        { name: 'Database Version', query: 'SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1' },
        { name: 'Current User', query: 'SELECT USER FROM DUAL' },
        { name: 'Current Schema', query: 'SELECT SYS_CONTEXT(\'USERENV\', \'CURRENT_SCHEMA\') AS CURRENT_SCHEMA FROM DUAL' },
        { name: 'Session Info', query: 'SELECT SYS_CONTEXT(\'USERENV\', \'SESSIONID\') AS SESSION_ID, SYS_CONTEXT(\'USERENV\', \'SERVER_HOST\') AS SERVER_HOST FROM DUAL' }
      ];
      
      const info = {};
      for (const queryInfo of queries) {
        const result = await connection.execute(queryInfo.query);
        info[queryInfo.name] = result.rows[0];
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Oracle Database Connection Information:\n\n${JSON.stringify(info, null, 2)}`,
          },
        ],
      };
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Oracle MCP Server running on stdio');
  }
}

// Start the server
const server = new OracleMCPServer();
server.run().catch(console.error);
