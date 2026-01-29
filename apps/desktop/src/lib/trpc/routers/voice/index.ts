import { observable } from "@trpc/server/observable";
import {
	getCurrentVoiceState,
	startVoiceProcess,
	stopVoiceProcess,
	voiceProcessEmitter,
} from "main/lib/voice/voice-process";
import type { VoiceSidecarEvent } from "shared/voice";
import { publicProcedure, router } from "../..";

export const createVoiceRouter = () => {
	let subscriberCount = 0;

	return router({
		subscribe: publicProcedure.subscription(() => {
			return observable<VoiceSidecarEvent>((emit) => {
				subscriberCount++;

				// Auto-start the voice process when first subscriber connects
				if (subscriberCount === 1) {
					startVoiceProcess();
				}

				emit.next(getCurrentVoiceState());

				const onVoiceEvent = (event: VoiceSidecarEvent) => {
					emit.next(event);
				};

				voiceProcessEmitter.on("voice-event", onVoiceEvent);

				return () => {
					voiceProcessEmitter.off("voice-event", onVoiceEvent);
					subscriberCount--;

					// Auto-stop when last subscriber disconnects
					if (subscriberCount === 0) {
						stopVoiceProcess();
					}
				};
			});
		}),

		start: publicProcedure.mutation(() => {
			startVoiceProcess();
			return { success: true as const };
		}),

		stop: publicProcedure.mutation(() => {
			stopVoiceProcess();
			return { success: true as const };
		}),
	});
};
