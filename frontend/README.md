# Frontend

The frontend for the PREPARE USAGI Tool, built with React 19, TypeScript, and Vite.

## ☑️ Requirements

- [Node.js 18+](https://nodejs.org/)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## 🛠️ Setup

Run this once from the `frontend/` folder (or whenever `package.json` changes):

```bash
npm install
```

## 🏗️ Development

Start the dev server with hot module replacement (changes reflect instantly in the browser):

```bash
npm run dev
```

The app will be available at **http://localhost:5173** by default.

> The frontend talks to the backend API at `http://localhost:8000`. Make sure the backend is also running in a separate terminal — see [backend/README.md](../backend/README.md).

## 🚀 Production

To start the app in production mode, run the following command in the terminal:

```bash
npm run build         # Compile and bundle for production (output in /dist)
npm run preview       # Preview the production build locally
```

> For a full production setup, use Docker instead — see the root [README.md](../README.md).

## 🐳 Dockerize

To dockerize the app, run the following command in the terminal:

```bash
# build the docker image
docker build -t frontend .

# run the docker container
docker run -d --name frontend -p 3000:3000 frontend
```
