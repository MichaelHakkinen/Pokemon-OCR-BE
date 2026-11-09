# Pokemon OCR Backend (NestJS Gateway & Prisma PostgreSQL)

Central API Gateway, collection manager, resolution engine, and database orchestrator for the Pokémon Trading Card scanner system.

---

## Architecture Overview
- **PostgreSQL 16**: Containerized database initialized with `uuid-ossp`, `pg_trgm`, and `unaccent` extensions.
- **Prisma ORM**: Manages `Set`, `Card`, `CardTranslation`, `UserCardCollection`, and `ExportConfig` models.
- **Two-Stage Card Resolution**:
  1. Exact matching on set code (`sv2a`, `MEW`, `TG04/TG30`) and collector number (`025/165`, `025`).
  2. Fallback matching leveraging PostgreSQL `SIMILARITY()` / `pg_trgm` GIN indexes for Latin scripts and normalized matching for CJK scripts.
- **Modular CSV Export Engine**:
  - Global toggle for pre-export survey dialog.
  - User-configurable dynamic fields (Condition, Grade, Currency, Price, Storage Box ID, Notes).
  - Streaming CSV generation endpoint (`GET /collection/export-csv` and `POST /collection/export-csv`).

---

## Getting Started

### 1. Spin up PostgreSQL 16 & Redis
```bash
docker compose up -d
```
Verifies that PostgreSQL 16 is running on port `5432` and `docker/postgres/init.sql` has enabled `pg_trgm` and `uuid-ossp`.

### 2. Configure Environment Variables
Create or update `.env` in the repository root:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pokemon_ocr_db"
OCR_SERVICE_URL="http://localhost:8000"
APP_PORT=3003
APP_URL="http://localhost:3003"
APP_ENV="development"
JWT_SECRET_KEY="your-random-32-char-secret-key-change-in-prod"
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm install
npx prisma generate
```

### 4. Run Migrations & Seed Sample Multilingual Data
```bash
# Run migrations (including pg_trgm GIN index on card_translations)
npx prisma migrate dev --name init_pokemon_tcg_models

# Seed sets (sv2a, MEW, LOR-TG) and cards in EN, JA, ID, KO, ZH, FR, DE
npm run seed
```

### 5. Start Development Server
```bash
npm run start:dev
```
The NestJS server will start on `http://localhost:3003`.
Access Swagger API documentation at:
- `http://localhost:3003/docs` (or Scalar reference at `http://localhost:3003/reference`)

---

## Endpoints

### 1. Card OCR Scanning (`OcrModule`)
- **`POST /ocr/scan`**
  - Consumes: `multipart/form-data` with `image` (binary) and optional `languageHint` (`auto`, `latin`, `japanese`, `korean`, `chinese`).
  - Calls Python microservice and resolves card candidate against PostgreSQL catalog.

### 2. Collection & Dynamic CSV Export (`CollectionModule`)
- **`GET /collection`**: Get user's card collection.
- **`POST /collection`**: Add card to collection with grade, condition, quantity, and custom fields.
- **`GET /collection/export-config`**: Fetch current pre-export survey modal questions and toggle state.
- **`PUT /collection/export-config`**: Update pre-export popup questions, field types, and enable/disable toggle.
- **`GET /collection/export-csv`**: Downloads CSV formatted with standard metadata and custom columns.
- **`POST /collection/export-csv`**: Submits dynamic survey responses and streams back the populated CSV file.

