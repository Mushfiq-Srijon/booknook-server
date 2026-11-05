# 📖 BookNook Server – Express.js REST API

Backend API engine powering **BookNook**, built with Express.js, MongoDB native driver, and JWT token authentication.

---

## 🛠️ Tech Stack & Architecture
- **Framework:** Express.js 5.x with TypeScript
- **Database:** MongoDB 7.x native driver
- **Authentication:** `jose` JWT verification with BetterAuth remote JWKS key set
- **Dev Tooling:** `tsx`, TypeScript compiler

---

## 🔒 API Endpoints

1. `GET /api/books` — Public library catalog retrieval with query filtering (`limit`, `category`, `search`, `email`).
2. `GET /api/books/:id` — Public single book details.
3. `POST /api/books` — Authenticated endpoint to add a new book to the database.
4. `PATCH /api/books/:id` — Authenticated endpoint for book creator to modify book details.
5. `DELETE /api/books/:id` — Authenticated endpoint to remove a book (prevents deletion if active borrows exist).
6. `POST /api/borrows` — Authenticated endpoint to borrow a book (atomic `$inc` decrement and double-borrow validation).
7. `GET /api/borrows` — Authenticated endpoint to retrieve only the logged-in user's active borrows.
8. `DELETE /api/borrows/:id` — Authenticated endpoint to return a book (atomic `$inc` increment).

---

## 🚀 Running Locally
```bash
npm install
npm run dev
```
Production build:
```bash
npm run build
npm start
```
