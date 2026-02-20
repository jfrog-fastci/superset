import { extractAssetUrls } from "./extract-asset-urls";
import { mirrorLinearAsset } from "./fetch-and-mirror";

interface AssetSource {
	sourceKind: string;
	markdown?: string | null;
	url?: string | null;
}

interface SyncTaskAssetsOptions {
	organizationId: string;
	taskId: string;
	sources: AssetSource[];
}

export async function syncTaskAssets(
	options: SyncTaskAssetsOptions,
): Promise<Map<string, string>> {
	const sourceKindByUrl = new Map<string, string>();

	for (const source of options.sources) {
		if (source.url) {
			sourceKindByUrl.set(source.url, source.sourceKind);
		}

		for (const url of extractAssetUrls(source.markdown)) {
			if (!sourceKindByUrl.has(url)) {
				sourceKindByUrl.set(url, source.sourceKind);
			}
		}
	}

	const urlMap = new Map<string, string>();

	for (const [sourceUrl, sourceKind] of sourceKindByUrl.entries()) {
		try {
			const mirrored = await mirrorLinearAsset({
				organizationId: options.organizationId,
				taskId: options.taskId,
				sourceUrl,
				sourceKind,
			});
			if (mirrored) {
				urlMap.set(sourceUrl, mirrored.blobUrl);
			}
		} catch (error) {
			console.warn(
				`[linear/assets] Failed to mirror asset ${sourceUrl}:`,
				error,
			);
		}
	}

	return urlMap;
}
