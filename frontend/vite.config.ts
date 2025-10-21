import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url"; // ✅ pakai ESM, bukan __dirname

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // arahkan alias client ke file baru yang sudah kamu rename
      "~backend/client": fileURLToPath(
        new URL("./api-client.ts", import.meta.url)
      ),
      "~backend": fileURLToPath(new URL("../backend", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), react()],
  build: { 
    outDir: "dist",
    minify: true,
    sourcemap: false
  },
});
