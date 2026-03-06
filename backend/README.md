# Backend API

This project includes the PREPARE Extraction Tool backend implementation. It uses the [FastAPI] framework.

## ☑️ Requirements

Before starting the project make sure these requires are available:

- [python]. For running the app (python version >= 3.10)
- [git]. For versioning the code.

## 🛠️ Setup

### Create a python environment

Run the following command to create a python environment:

```bash
# create a new virtual environment
python -m venv venv

# activate the environment (UNIX)
. ./venv/bin/activate

# activate the environment (WINDOWS)
./venv/Scripts/activate

# deactivate the environment (UNIX & WINDOWS)
deactivate
```

### Install the requirements

Run the following command to install the requirements:

```bash
pip install -e .[dev]
```

## 🗄️ Database Migrations

This project uses Alembic for database schema migrations. Before running the app for the first time, you need to apply database migrations:

```bash
# Apply all pending migrations
./scripts/alembic_upgrade.sh

# Or using Alembic directly
alembic upgrade head
```

> **⚠️ IMPORTANT: When You Modify `models_db.py`**
>
> Alembic does **NOT** automatically detect changes to your database models. When you add, modify, or remove fields in `app/models_db.py`, you must explicitly:
>
> 1. **Generate** a new migration using autogenerate (detects model changes)
> 2. **Review** the generated migration file to ensure correctness
> 3. **Apply** the migration to update the database schema
>
> Alembic's autogenerate is powerful but not perfect—always review the generated migration before applying it!

### Updating the Database Schema (Two-Step Process)

When you modify database models in `app/models_db.py`, follow this workflow:

#### Step 1: Generate a New Migration (Autogenerate)

```bash
# Using the convenience script (automatically assigns sequential revision IDs)
./scripts/alembic_autogenerate.sh "add user preferences table"

# Or using Alembic directly
alembic revision --autogenerate --rev-id 004 -m "add user preferences table"
```

This will:
- Scan your `models_db.py` and compare it to the current database schema
- Generate a new migration file in `alembic/versions/` with the detected changes
- Use sequential revision IDs (001, 002, 003, etc.)

#### Step 2: Review and Apply the Migration

```bash
# First, REVIEW the generated migration file in alembic/versions/
# Then apply it:
./scripts/alembic_upgrade.sh

# Or using Alembic directly
alembic upgrade head
```

### Common Migration Commands

```bash
# Check current migration status
./scripts/alembic_current.sh

# Rollback the last migration
./scripts/alembic_downgrade.sh

# View migration history
./scripts/alembic_history.sh

# Apply all pending migrations
./scripts/alembic_upgrade.sh

# Or use Alembic directly:
alembic current                # Show current revision
alembic downgrade -1           # Rollback one migration
alembic history                # Show migration history
alembic upgrade head           # Apply all pending migrations
```

For detailed migration documentation, see [docs/migrations.md](docs/migrations.md).

## 🏗️ Development

To start the app in development mode, run the following command in the terminal:

```bash
fastapi dev ./app/main.py --port 8000
```

The app will be available at **http://localhost:8000** by default.

### API Docs

To see the API documentation, visit either:

| URL                         | Description                                         |
| --------------------------- | --------------------------------------------------- |
| http://127.0.0.1:8000/docs  | Automatic iteractive API documentation (Swagger UI) |
| http://127.0.0.1:8000/redoc | Alternative automatic documentation (ReDoc)         |

## 🚀 Production

To start the app in production mode, run the following command in the terminal:

```bash
fastapi run ./app/main.py --port 8000
```

or, alternatively,

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

> For a full production setup, use Docker instead — see the root [README.md](../README.md).

## 🐳 Dockerize

To dockerize the app, run the following command in the terminal:

```bash
# build the docker image
docker build -t backend .

# run the docker container
docker run -d --name backend -p 8000:8000 backend
```

To change the port, change the `8000` to your desired port.

[FastAPI]: https://fastapi.tiangolo.com/
[python]: https://www.python.org/
[git]: https://git-scm.com/
