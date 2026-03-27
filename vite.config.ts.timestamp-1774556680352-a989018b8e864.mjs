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
      "/actuator": "http://localhost:8080",
      "/admin": "http://localhost:8080"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxEQU5JRUxcXFxccHJvamVjdHNcXFxcb2ZmbGluZS1zcHJpbmctaW5pdFxcXFx1aVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcREFOSUVMXFxcXHByb2plY3RzXFxcXG9mZmxpbmUtc3ByaW5nLWluaXRcXFxcdWlcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0RBTklFTC9wcm9qZWN0cy9vZmZsaW5lLXNwcmluZy1pbml0L3VpL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3RhaWx3aW5kY3NzKCksIHJlYWN0KCldLFxuICBzZXJ2ZXI6IHtcbiAgICBwcm94eToge1xuICAgICAgJy9tZXRhZGF0YSc6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxuICAgICAgJy9zdGFydGVyLnppcCc6ICAgICAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJyxcbiAgICAgICcvc3RhcnRlci5wcmV2aWV3JzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsXG4gICAgICAnL2FjdHVhdG9yJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsXG4gICAgICAnL2FkbWluJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsXG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyVSxTQUFTLG9CQUFvQjtBQUN4VyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFFeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUM7QUFBQSxFQUNoQyxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxhQUFhO0FBQUEsTUFDYixnQkFBb0I7QUFBQSxNQUNwQixvQkFBb0I7QUFBQSxNQUNwQixhQUFhO0FBQUEsTUFDYixVQUFVO0FBQUEsSUFDWjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
