# Integrating Oracle MCP Server with Trae AI

This guide explains how to add the Oracle MCP server to your Trae AI environment.

## Quick Setup

### 1. Ensure Dependencies are Installed

```bash
npm install
```

### 2. Configure Environment Variables

Make sure your `.env` file contains the correct Oracle database credentials:

```env
ORACLE_USER=your_username
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=host:port/service_name
MCP_SERVER_NAME=oracle-mcp-server
MCP_SERVER_VERSION=1.0.0
```

### 3. Test the Server

Verify the server works correctly:

```bash
npm test
```

## Adding to Trae AI

### Method 1: Using Trae Configuration File

If Trae AI supports MCP server configuration files, use the provided `trae-config.json`:

```json
{
  "name": "Oracle Database MCP Server",
  "type": "mcp",
  "config": {
    "command": "node",
    "args": ["oracle-mcp-server.js"],
    "cwd": "e:\\working_directory\\mpcserver\\orcldb",
    "env": {
      "ORACLE_USER": "CBLNG300625",
      "ORACLE_PASSWORD": "c",
      "ORACLE_CONNECT_STRING": "192.168.1.163:1521/CTBLDB"
    }
  }
}
```

### Method 2: Manual Integration

1. **Copy the server files** to your Trae AI MCP servers directory
2. **Update Trae's MCP configuration** to include:
   - Server name: `oracle-mcp-server`
   - Command: `node oracle-mcp-server.js`
   - Working directory: Path to this folder
   - Environment variables from `.env` file

### Method 3: Direct Command Line

If Trae AI allows adding MCP servers via command line:

```bash
trae add-mcp-server \
  --name "oracle-mcp-server" \
  --command "node" \
  --args "oracle-mcp-server.js" \
  --cwd "e:\working_directory\mpcserver\orcldb" \
  --env "ORACLE_USER=CBLNG300625" \
  --env "ORACLE_PASSWORD=c" \
  --env "ORACLE_CONNECT_STRING=192.168.1.163:1521/CTBLDB"
```

## Available Tools in Trae

Once integrated, you'll have access to these Oracle database tools:

### 🔍 **execute_query**
- Execute SELECT queries safely
- Supports parameter binding
- Returns formatted results

**Example usage in Trae:**
```
"Execute a query to show current user and date"
Tool: execute_query
Parameters: {"query": "SELECT USER, SYSDATE FROM DUAL"}
```

### ✏️ **execute_dml**
- Perform INSERT, UPDATE, DELETE operations
- Supports parameter binding
- Returns affected row count

**Example usage in Trae:**
```
"Update employee salary"
Tool: execute_dml
Parameters: {
  "statement": "UPDATE employees SET salary = :1 WHERE employee_id = :2",
  "binds": ["5000", "123"]
}
```

### 📋 **describe_table**
- Get detailed table structure
- Shows columns, data types, constraints
- Supports schema specification

**Example usage in Trae:**
```
"Show me the structure of the employees table"
Tool: describe_table
Parameters: {"table_name": "employees"}
```

### 📊 **list_tables**
- List all accessible tables
- Optional schema filtering
- Shows table ownership

**Example usage in Trae:**
```
"List all tables in the HR schema"
Tool: list_tables
Parameters: {"schema": "hr"}
```

### 🔗 **get_connection_info**
- Database version information
- Current user and schema
- Session details

**Example usage in Trae:**
```
"Show database connection information"
Tool: get_connection_info
Parameters: {}
```

## Troubleshooting

### Common Issues

1. **Server won't start**
   - Check Oracle Instant Client installation
   - Verify database credentials in `.env`
   - Ensure Node.js dependencies are installed

2. **Connection errors**
   - Test database connectivity manually
   - Check firewall settings
   - Verify Oracle service is running

3. **Permission errors**
   - Ensure database user has required privileges
   - Check table access permissions

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=oracle-mcp-server
```

## Security Notes

- Database credentials are stored in environment variables
- All queries use parameter binding to prevent SQL injection
- Query types are restricted (SELECT only for queries, DML only for modifications)
- Connections are automatically closed after each operation

## Support

If you encounter issues:

1. Check the server logs for error messages
2. Test the server independently using `npm test`
3. Verify Oracle database connectivity
4. Ensure all dependencies are properly installed

The Oracle MCP server is now ready to be used within Trae AI for all your Oracle database operations!