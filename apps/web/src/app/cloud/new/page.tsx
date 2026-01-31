import { auth } from "@superset/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { api } from "@/trpc/server";
import { NewSessionForm } from "./components/NewSessionForm";

export default async function NewCloudSessionPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/sign-in");
	}

	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) {
		redirect("/");
	}

	const trpc = await api();
	const repositories =
		await trpc.repository.byOrganization.query(organizationId);

	return <NewSessionForm repositories={repositories} />;
}
