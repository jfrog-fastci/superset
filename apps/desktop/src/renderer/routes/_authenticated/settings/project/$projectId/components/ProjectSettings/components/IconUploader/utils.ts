const ALLOWED_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/svg+xml",
	"image/webp",
	"image/x-icon",
];

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const MAX_DIMENSION = 128;

/**
 * Validates and processes an icon file, returning a base64 data URL.
 * Resizes raster images to 128x128 max while maintaining aspect ratio.
 */
export async function processIconFile(file: File): Promise<string> {
	if (!ALLOWED_TYPES.includes(file.type)) {
		throw new Error(
			"Unsupported file type. Please use PNG, JPG, GIF, SVG, WebP, or ICO.",
		);
	}

	if (file.size > MAX_FILE_SIZE) {
		throw new Error(
			`File too large. Maximum size is ${MAX_FILE_SIZE / 1024}KB.`,
		);
	}

	const dataUrl = await readFileAsDataUrl(file);

	if (file.type === "image/svg+xml" || file.type === "image/x-icon") {
		return dataUrl;
	}

	return resizeImage(dataUrl, MAX_DIMENSION);
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

/**
 * Resizes an image to fit within maxDimension while maintaining aspect ratio.
 * Returns a PNG data URL.
 */
export function resizeImage(
	dataUrl: string,
	maxDimension: number,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			let { width, height } = img;

			if (width > maxDimension || height > maxDimension) {
				if (width > height) {
					height = Math.round((height / width) * maxDimension);
					width = maxDimension;
				} else {
					width = Math.round((width / height) * maxDimension);
					height = maxDimension;
				}
			}

			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Failed to get canvas context"));
				return;
			}

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(img, 0, 0, width, height);

			resolve(canvas.toDataURL("image/png"));
		};
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}
