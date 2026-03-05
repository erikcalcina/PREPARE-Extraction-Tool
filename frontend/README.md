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

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
