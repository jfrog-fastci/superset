import { auth } from "@superset/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { api } from "@/trpc/server";
import { CloudHomePage } from "./components/CloudHomePage";

export default async function CloudPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/sign-in");
	}

	const trpc = await api();
	const workspaces = await trpc.cloudWorkspace.list.query();

	return <CloudHomePage workspaces={workspaces} />;
}
