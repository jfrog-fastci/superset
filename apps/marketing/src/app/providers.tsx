"use client";

import { OutlitProvider as OutlitBrowserProvider } from "@outlit/browser/react";
import { THEME_STORAGE_KEY } from "@superset/shared/constants";
import { ThemeProvider } from "next-themes";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

import { outlit } from "@/lib/outlit";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<PostHogProvider client={posthog}>
			<OutlitBrowserProvider client={outlit}>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					forcedTheme="dark"
					storageKey={THEME_STORAGE_KEY}
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
			</OutlitBrowserProvider>
		</PostHogProvider>
	);
}
