# Azure SQL Database Setup Notes

## Connection String Format

For Azure SQL Database, use this format:

```
mssql+pyodbc://USERNAME:PASSWORD@SERVER.database.windows.net:1433/DATABASE_NAME?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30
```

## Important Parameters

- `mssql+pyodbc://` - SQLAlchemy dialect for SQL Server via pyodbc
- `Encrypt=yes` - Required for Azure SQL Database
- `TrustServerCertificate=no` - Use proper SSL certificate validation
- `Connection+Timeout=30` - Connection timeout in seconds
- `driver=ODBC+Driver+17+for+SQL+Server` - ODBC driver name

## URL Encoding Special Characters

If your password contains special characters, URL encode them:
- `@` becomes `%40`
- `#` becomes `%23`
- `$` becomes `%24`
- `%` becomes `%25`
- `&` becomes `%26`
- `+` becomes `%2B`
- `=` becomes `%3D`

Example:
- Password: `My@Pass#123`
- Encoded: `My%40Pass%23123`

## Testing Connection Locally

Before deploying, test the connection string locally:

```python
from sqlalchemy import create_engine

DATABASE_URL = "mssql+pyodbc://tallyadmin:PASSWORD@SERVER.database.windows.net:1433/tally-system-db?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30"

engine = create_engine(DATABASE_URL)
connection = engine.connect()
print("Connection successful!")
connection.close()
```

## ODBC Driver Installation

### Windows (Local Development)
1. Download: https://docs.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server
2. Install "ODBC Driver 17 for SQL Server"

### Linux (Azure App Service)
ODBC Driver 17 is pre-installed on Azure App Service Linux.

### Mac (Local Development)
```bash
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install msodbcsql17 mssql-tools
```

## Common Issues

### "Driver not found"
- Ensure ODBC Driver 17 is installed
- On Azure App Service, it's pre-installed
- Check driver name matches exactly: `ODBC+Driver+17+for+SQL+Server`

### "Login failed"
- Verify username and password are correct
- Check if server firewall allows your IP
- Ensure "Allow Azure services" is enabled

### "Connection timeout"
- Check firewall rules
- Verify server name is correct
- Increase timeout value if needed

### "Encryption required"
- Azure SQL Database requires encryption
- Ensure `Encrypt=yes` is in connection string

