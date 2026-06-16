const {
    GoogleGenerativeAI,
} = require("@google/generative-ai");
const { AppError } = require("../../utils/errors");

function getGeminiApiKey() {
    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
        throw new AppError("AI_NOT_CONFIGURED", "Gemini API key is not configured", 500);
    }

    return apiKey;
}

function getGeminiModel() {
    const genAi = new GoogleGenerativeAI(getGeminiApiKey());

    return genAi.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    });
}

function mapGeminiError(error) {
    const status = Number(error?.status || error?.response?.status || 500);
    const message = String(error?.message || "");
    const lowerMessage = message.toLowerCase();

    if (status === 429 && lowerMessage.includes("prepayment credits are depleted")) {
        return new AppError(
            "AI_CREDITS_DEPLETED",
            "AI description generation is temporarily unavailable because Gemini credits are depleted.",
            402
        );
    }

    if (status === 429) {
        return new AppError(
            "AI_RATE_LIMITED",
            "AI description generation is temporarily rate limited. Please try again later.",
            429
        );
    }

    if (status === 401 || status === 403) {
        return new AppError(
            "AI_AUTH_FAILED",
            "AI provider authentication failed. Please check Gemini API key and billing access.",
            502
        );
    }

    if (status >= 400 && status < 500) {
        return new AppError(
            "AI_BAD_REQUEST",
            "AI provider rejected the description request.",
            400
        );
    }

    return new AppError(
        "AI_PROVIDER_ERROR",
        "AI description generation failed. Please try again later.",
        502
    );
}

async function generateProductDescription({ name }) {
    if (!name || !String(name).trim()) {
        throw new AppError("VALIDATION_ERROR", "Product name is required", 400);
    }

//     const prompt = `
// You are generating product descriptions for a premium fresh vegetable and fruit delivery app. like a product description writer. The descriptions will be used on the app to help customers understand the products better and make informed purchase decisions.

// Product Name:
// ${name}

// Requirements:
// - Write only 1-2 short customer-friendly lines.
// - After 2-3 lines Mention important nutrients dynamically based on the actual product with bullet points.
// - Keep response short and clean.
// - No headings.
// - No fake claims.
// - No extra explanation.

// Example:
// Fresh tomatoes are juicy, naturally sweet, and perfect for daily cooking. Rich in vitamin C, potassium, folate, and lycopene.
// Nutrients :
// - Vitamin C: Supports immune health and skin vitality.
// - Potassium: Helps maintain healthy blood pressure.
// - Folate: Essential for cell function and tissue growth.
// - Lycopene: A powerful antioxidant that may reduce the risk of certain diseases.

// Now, generate a description for the product name mentioned above.
// `;

    const prompt = `
You are generating product descriptions for a premium fresh vegetable and fruit delivery app.

Product Name:
${name}

Requirements:
- Write only 1-2 short customer-friendly lines.
- After 1-2 lines Mention important nutrients dynamically based on the actual product.
- Keep response short and clean.
- No markdown.
- No bullets.
- No headings.
- No fake claims.
- No extra explanation.

Example Output :
Add a zesty twist to your meals with our farm-fresh Lemons. Naturally sour, rich in vitamin C, and perfect for detox drinks, salads, chutneys, or daily cooking. Sourced directly from local farms for maximum freshness and juice content.

🥗 Key Nutrients (Per 100g serving)

Nutrient	Amount	% Daily Value*
Calories	29 kcal	1%
Carbohydrates	9.3 g	3%
Sugars	2.5 g	–
Dietary Fiber	2.8 g	10%
Protein	1.1 g	2%
Fat	0.3 g	0%
Vitamin C	53 mg	59%
Vitamin B6	0.08 mg	5%
Potassium	138 mg	4%
Calcium	26 mg	2%
Iron	0.6 mg	3%
Magnesium	8 mg	2%

Also Add Perfect space and formatting for easy readability on the app.
`;

    let result;
    try {
        result = await getGeminiModel().generateContent(prompt);
    } catch (error) {
        throw mapGeminiError(error);
    }

    return result.response.text().trim();
}

async function listGeminiModels() {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );

    const data = await res.json();

    console.log(
        data.models
            ?.filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
            ?.map((m) => ({
                name: m.name,
                methods: m.supportedGenerationMethods,
            }))
    );
}

// listGeminiModels();

module.exports = {
    generateProductDescription,
};
