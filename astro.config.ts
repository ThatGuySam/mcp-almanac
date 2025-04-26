import { defineConfig } from "astro/config";
import type { AstroUserConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import netlify from "@astrojs/netlify";

const config: AstroUserConfig = defineConfig({
	site: "https://example.com",
	adapter: netlify(),
	integrations: [
		tailwind({
			applyBaseStyles: false,
		}),
	],
});

// https://astro.build/config
export default defineConfig(config);
