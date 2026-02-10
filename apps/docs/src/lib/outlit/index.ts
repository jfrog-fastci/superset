import { Outlit } from "@outlit/browser";

import { env } from "@/env";

export const outlit = new Outlit({
	publicKey: env.NEXT_PUBLIC_OUTLIT_KEY,
	trackPageviews: true,
});
