import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: change base to match your GitHub repo name, e.g. "/mealprep-ledger/"
// If deploying to a user/org page (username.github.io), set base to "/"
export default defineConfig({
  plugins: [react()],
  base: "/mealprep-ledger/",
});
