# Installation Guide - Fixing Rust/Cargo Issues

If you're getting Rust/Cargo compilation errors when installing requirements, here are several solutions:

## Solution 1: Install Without PostgreSQL (Recommended for Local Development)

Since we use SQLite by default, you don't need PostgreSQL drivers:

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install without PostgreSQL support (no rust needed)
pip install -r requirements.txt
```

The `requirements.txt` file has been updated to exclude `psycopg2-binary` by default.

## Solution 2: Use Pre-built Wheels

Force pip to use pre-built wheels instead of compiling:

```bash
pip install --only-binary :all: -r requirements.txt
```

## Solution 3: Install Rust (If You Need PostgreSQL)

If you need PostgreSQL support and want to install `psycopg2-binary`:

### Windows:
1. Install Rust from: https://rustup.rs/
2. Or use pre-built binary: `pip install psycopg2-binary --only-binary :all:`

### Mac:
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Then install requirements
pip install -r requirements.txt
```

### Linux:
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install build dependencies
sudo apt-get install build-essential libssl-dev libffi-dev python3-dev

# Then install requirements
pip install -r requirements.txt
```

## Solution 4: Use Alternative PostgreSQL Driver

Instead of `psycopg2-binary`, use `psycopg` (pure Python, no compilation needed):

```bash
# Install psycopg instead
pip install psycopg[binary]
```

Then update your database URL to use `psycopg` instead of `psycopg2`.

## Solution 5: Install Dependencies One by One

Sometimes installing packages individually helps identify the problematic one:

```bash
pip install fastapi
pip install uvicorn[standard]
pip install sqlalchemy
pip install alembic
pip install pydantic
pip install pydantic-settings
pip install python-dotenv
pip install requests

# Skip psycopg2-binary if using SQLite
# pip install psycopg2-binary  # Only if using PostgreSQL
```

## Solution 6: Use Docker (No Rust Needed)

If you have Docker installed, you can avoid all compilation issues:

```bash
# Build and run in Docker
cd backend
docker build -t tally-backend .
docker run -p 8000:8000 tally-backend
```

## Quick Fix for Most Cases

**For local development with SQLite (no PostgreSQL needed):**

```bash
cd backend
python -m venv venv

# Activate
venv\Scripts\activate  # Windows
# OR
source venv/bin/activate  # Mac/Linux

# Install core dependencies (no PostgreSQL)
pip install fastapi uvicorn[standard] sqlalchemy alembic pydantic pydantic-settings python-dotenv requests

# Run migrations and start server
alembic upgrade head
uvicorn app.main:app --reload
```

This should work without any Rust/Cargo dependencies!

## Verify Installation

After installation, verify everything works:

```bash
# Check if FastAPI imports correctly
python -c "from fastapi import FastAPI; print('✅ FastAPI installed')"

# Check if SQLAlchemy works
python -c "from sqlalchemy import create_engine; print('✅ SQLAlchemy installed')"

# Start the server
uvicorn app.main:app --reload
```

## Still Having Issues?

If you're still getting errors:

1. **Check Python version**: Need Python 3.11+
   ```bash
   python --version
   ```

2. **Upgrade pip**:
   ```bash
   python -m pip install --upgrade pip
   ```

3. **Clear pip cache**:
   ```bash
   pip cache purge
   ```

4. **Use virtual environment** (always recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   ```

5. **Check error message**: The error will tell you which package is causing issues. You can usually skip that package if it's optional.

## For Production (Azure Deployment)

When deploying to Azure, PostgreSQL drivers will be installed automatically in the Docker container, so you won't need to worry about Rust on your local machine.

