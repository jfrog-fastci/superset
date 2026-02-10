"use client";

import { OutlitProvider } from "@outlit/browser/react";

import { outlit } from "@/lib/outlit";

export function OutlitProviderWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	return <OutlitProvider client={outlit}>{children}</OutlitProvider>;
}
