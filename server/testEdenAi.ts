import "dotenv/config";
import fs from "fs/promises";

const apiKey = process.env.EDEN_AI_API_KEY;

if (!apiKey) {
    throw new Error("❌ EDEN_AI_API_KEY is missing from .env");
}

const prompt =
    "A cinematic dark luxury car parked alone in a rainy city at night, dramatic lighting, moody atmosphere, ultra detailed";

console.log("⏳ Generating image with Eden AI...");

const response = await fetch(
    "https://api.edenai.run/v3/universal-ai",
    {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "image/generation/bytedance",
            input: {
                text: prompt
            }
        })
    }
);

const data = await response.json();

if (!response.ok) {
    console.error("❌ Eden AI API Error");
    console.error("Status:", response.status);
    console.error("Response:", data);

    process.exit(1);
}

console.log("✅ Eden AI request successful!");

console.log("Response:");
console.log(JSON.stringify(data, null, 2));

// Eden AI returns an image URL in image_resource_url
const imageUrl = data?.output?.image_resource_url;

if (!imageUrl) {
    console.error("❌ Image URL was not found in Eden AI response.");
    console.log(JSON.stringify(data, null, 2));
    process.exit(1);
}

console.log("🖼️ Image URL received!");
console.log(imageUrl);

const imageResponse = await fetch(imageUrl);

if (!imageResponse.ok) {
    throw new Error(
        `Failed to download generated image: ${imageResponse.status}`
    );
}

const imageBuffer = Buffer.from(
    await imageResponse.arrayBuffer()
);

await fs.writeFile("eden-test-image.jpg", imageBuffer);

console.log("✅ Image generated successfully!");
console.log("📁 Saved as: eden-test-image.jpg");
console.log("📦 Size:", imageBuffer.length, "bytes");