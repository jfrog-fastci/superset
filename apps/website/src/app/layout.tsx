import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Superset",
	description: "Superset Website",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="overscroll-none">
			<body className="overscroll-none">{children}</body>
		</html>
	);
}
