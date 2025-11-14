"""
Helper script to convert Azure SQL ADO.NET connection string to SQLAlchemy format
"""
import re
import urllib.parse

def convert_ado_to_sqlalchemy(ado_string, password=None):
    """
    Convert ADO.NET connection string to SQLAlchemy format
    
    Args:
        ado_string: ADO.NET connection string from Azure Portal
        password: Optional password to replace {your_password} placeholder
    
    Returns:
        SQLAlchemy connection string
    """
    # Parse ADO.NET connection string
    params = {}
    for part in ado_string.split(';'):
        if '=' in part:
            key, value = part.split('=', 1)
            params[key.strip()] = value.strip()
    
    # Extract values
    server = params.get('Server', '')
    # Remove tcp: prefix and port if present
    server = server.replace('tcp:', '').replace(',1433', '').strip()
    
    database = params.get('Initial Catalog', '')
    username = params.get('User ID', '')
    pwd = password or params.get('Password', '').replace('{your_password}', '')
    
    # URL encode password if it contains special characters
    pwd_encoded = urllib.parse.quote(pwd, safe='')
    
    # Build SQLAlchemy connection string
    sqlalchemy_url = (
        f"mssql+pyodbc://{username}:{pwd_encoded}@{server}:1433/{database}"
        f"?driver=ODBC+Driver+17+for+SQL+Server"
        f"&Encrypt=yes"
        f"&TrustServerCertificate=no"
        f"&Connection+Timeout=30"
    )
    
    return sqlalchemy_url


if __name__ == "__main__":
    print("Azure SQL Connection String Converter")
    print("=" * 50)
    print()
    
    # Example ADO.NET string
    example_ado = "Server=tcp:tally-system-sql.database.windows.net,1433;Initial Catalog=tally-system-db;Persist Security Info=False;User ID=tallyadmin;Password={your_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
    
    print("Example ADO.NET connection string:")
    print(example_ado)
    print()
    
    # Get password from user
    password = input("Enter your database password (or press Enter to use placeholder): ").strip()
    if not password:
        password = "{your_password}"
    
    # Convert
    sqlalchemy_url = convert_ado_to_sqlalchemy(example_ado, password if password != "{your_password}" else None)
    
    print()
    print("SQLAlchemy connection string:")
    print(sqlalchemy_url)
    print()
    print("Use this in your DATABASE_URL environment variable!")

