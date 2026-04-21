// vite.config.ts
import { defineConfig } from "file:///C:/Users/DANIEL/projects/offline-spring-init/ui/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/DANIEL/projects/offline-spring-init/ui/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/DANIEL/projects/offline-spring-init/ui/node_modules/@tailwindcss/vite/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      "/metadata": "http://localhost:8080",
      "/starter.zip": "http://localhost:8080",
      "/starter.preview": "http://localhost:8080",
      "/starter-multimodule.zip": "http://localhost:8080",
      "/starter-multimodule.preview": "http://localhost:8080",
      "/actuator": "http://localhost:8080",
      "/admin": "http://localhost:8080"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxEQU5JRUxcXFxccHJvamVjdHNcXFxcb2ZmbGluZS1zcHJpbmctaW5pdFxcXFx1aVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcREFOSUVMXFxcXHByb2plY3RzXFxcXG9mZmxpbmUtc3ByaW5nLWluaXRcXFxcdWlcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0RBTklFTC9wcm9qZWN0cy9vZmZsaW5lLXNwcmluZy1pbml0L3VpL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnXHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFt0YWlsd2luZGNzcygpLCByZWFjdCgpXSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvbWV0YWRhdGEnOiAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJyxcclxuICAgICAgJy9zdGFydGVyLnppcCc6ICAgICAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJyxcclxuICAgICAgJy9zdGFydGVyLnByZXZpZXcnOiAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJyxcclxuICAgICAgJy9zdGFydGVyLW11bHRpbW9kdWxlLnppcCc6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxyXG4gICAgICAnL3N0YXJ0ZXItbXVsdGltb2R1bGUucHJldmlldyc6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxyXG4gICAgICAnL2FjdHVhdG9yJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsXHJcbiAgICAgICcvYWRtaW4nOiAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJyxcclxuICAgIH1cclxuICB9XHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMlUsU0FBUyxvQkFBb0I7QUFDeFcsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBRXhCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDaEMsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsYUFBYTtBQUFBLE1BQ2IsZ0JBQW9CO0FBQUEsTUFDcEIsb0JBQW9CO0FBQUEsTUFDcEIsNEJBQTRCO0FBQUEsTUFDNUIsZ0NBQWdDO0FBQUEsTUFDaEMsYUFBYTtBQUFBLE1BQ2IsVUFBVTtBQUFBLElBQ1o7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
