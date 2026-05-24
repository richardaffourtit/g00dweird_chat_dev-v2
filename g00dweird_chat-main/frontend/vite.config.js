import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

function readEnvValue(env, key, fallback = "") {
  return env[`VITE_${key}`] ?? env[`REACT_APP_${key}`] ?? process.env[`REACT_APP_${key}`] ?? fallback;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const previewMock = readEnvValue(env, "PREVIEW_MOCK", "");
  const backendUrl = readEnvValue(env, "BACKEND_URL", "");
  const useCleanedSprites = readEnvValue(env, "USE_CLEANED_SPRITES", "");
  const processEnv = {
    NODE_ENV: mode,
    REACT_APP_PREVIEW_MOCK: previewMock,
    REACT_APP_BACKEND_URL: backendUrl,
    REACT_APP_USE_CLEANED_SPRITES: useCleanedSprites,
  };

  return {
    plugins: [
      {
        name: "load-js-files-as-jsx",
        enforce: "pre",
        async transform(code, id) {
          if (!id.match(/src\/.*\.js$/)) return null;
          return transformWithEsbuild(code, id, {
            loader: "jsx",
            jsx: "automatic",
          });
        },
      },
      react(),
    ],
    root: ".",
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    define: {
      "process.env": JSON.stringify(processEnv),
    },
    server: {
      port: 3000,
      host: true,
    },
    build: {
      outDir: "build",
      emptyOutDir: true,
    },
  };
});
