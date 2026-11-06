const MAX_PHOTOS = 4;
const MAX_TOTAL_BASE64_BYTES = 3_000_000;
const { randomUUID } = require("node:crypto");
const CATEGORIES = [
  "불법현수막",
  "도로 파손",
  "안전봉 파손",
  "보도블록 파손",
  "가로등 고장",
  "기타 시설물",
];

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  try {
    return new URL(origin).host.toLowerCase() === String(req.headers.host || "").toLowerCase();
  } catch {
    return false;
  }
}

function parsePhoto(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) return null;
  return { mimeType: match[1], data: match[2] };
}

function getErrorMessage(status, upstreamStatus = "", upstreamMessage = "") {
  const message = upstreamMessage.toLowerCase();
  if (status === 400) {
    if (message.includes("api key") || message.includes("api_key")) return "Gemini API 키 형식이 올바르지 않습니다. Google AI Studio에서 발급한 키인지 확인해 주세요.";
    return "Gemini가 사진 분석 요청을 거부했습니다. 사진 형식이나 Gemini 모델 설정을 확인해 주세요.";
  }
  if (status === 401 || status === 403) return "Gemini API 키가 유효하지 않거나 해당 키에서 Gemini API를 사용할 수 없습니다. 키와 Google AI Studio 설정을 확인해 주세요.";
  if (status === 404) return "Gemini 모델을 사용할 수 없습니다. Vercel Settings → Environment Variables에서 GEMINI_MODEL을 gemini-3.6-flash로 설정하거나 기존 값을 삭제해 주세요.";
  if (status === 429) return "Gemini 사용 한도 또는 요금 한도를 초과했습니다. Google AI Studio에서 할당량과 결제 설정을 확인해 주세요.";
  if (status === 500) return "Gemini 내부 오류(500)입니다. 다른 사진으로 다시 시도해 주세요. 같은 사진에서 반복되면 Vercel Functions 로그를 확인해 주세요.";
  if (status === 503) return "Gemini 서비스가 혼잡합니다(503). 잠시 기다린 뒤 다시 시도해 주세요.";
  if (status === 504) return "Gemini 응답 시간이 초과되었습니다(504). 사진 수를 줄이거나 잠시 후 다시 시도해 주세요.";
  if (status >= 500) return `Gemini 서비스 오류(${status})입니다. 잠시 후 다시 시도하고, 반복되면 Vercel Functions 로그를 확인해 주세요.`;
  if (upstreamStatus) return `Gemini 요청이 ${upstreamStatus} 오류로 실패했습니다.`;
  return "Gemini 사진 분석에 실패했습니다. API 키, 모델 설정, Vercel 배포 로그를 확인해 주세요.";
}

module.exports = async function handler(req, res) {
  if (!isSameOrigin(req)) return send(res, 403, { error: "Cross-origin requests are not allowed." });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  const input = req.body;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return send(res, 400, { error: "사진 분석 요청을 확인해 주세요." });
  }
  const requestId = typeof input.requestId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(input.requestId)
    ? input.requestId
    : randomUUID();

  if (input.apiKey !== undefined && (typeof input.apiKey !== "string" || input.apiKey.length > 512)) {
    return send(res, 400, { error: "Gemini API 키 입력을 확인해 주세요." });
  }
  const apiKey = (input.apiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return send(res, 503, { error: "로그인 화면에 Gemini API 키를 입력하거나 Vercel GEMINI_API_KEY 환경변수를 설정해 주세요." });

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) {
    return send(res, 500, { error: "Gemini 모델 설정이 올바르지 않습니다." });
  }

  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length < 1 || photos.length > MAX_PHOTOS) {
    return send(res, 400, { error: `사진은 1장 이상 ${MAX_PHOTOS}장 이하로 첨부해 주세요.` });
  }

  const totalBase64Bytes = photos.reduce((total, photo) => {
    return total + (typeof photo?.dataUrl === "string" ? Buffer.byteLength(photo.dataUrl, "utf8") : 0);
  }, 0);
  if (totalBase64Bytes > MAX_TOTAL_BASE64_BYTES) {
    return send(res, 413, { error: "사진 용량이 큽니다. 사진 수를 줄이거나 다시 촬영해 주세요." });
  }

  const parsedPhotos = photos.map(photo => parsePhoto(photo?.dataUrl));
  if (parsedPhotos.some(photo => !photo)) {
    return send(res, 400, { error: "JPG, PNG 또는 WebP 사진만 분석할 수 있습니다." });
  }

  const selectedCategory = CATEGORIES.includes(input.category) ? input.category : "";
  const prompt = [
    "당신은 한국 지방자치단체의 현장 신고 작성을 돕습니다.",
    "첨부된 사진에서 직접 확인할 수 있는 시설물과 상태만 근거로 신고 초안을 작성하세요.",
    "사진만으로 불법 여부, 원인, 피해 규모, 위치 또는 안전 위험을 단정하지 마세요. 보이지 않는 정보는 만들어내지 말고 객관적이고 간결하게 표현하세요.",
    `category는 다음 중 하나만 선택하세요: ${CATEGORIES.join(", ")}.`,
    selectedCategory ? `사용자가 선택한 신고 유형은 '${selectedCategory}'입니다. 사진과 명백히 다르지 않으면 이 유형을 유지하세요.` : "",
    "description은 담당자가 현장을 확인할 수 있도록 관찰된 상태와 필요한 확인 사항을 한국어 한두 문장으로 작성하세요.",
    "JSON 형식으로 category와 description만 반환하세요.",
  ].filter(Boolean).join("\n");
  const contents = [
    { text: prompt },
    ...parsedPhotos.map(photo => ({ inlineData: photo })),
  ];

  let upstream;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: contents }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING", enum: CATEGORIES },
              description: { type: "STRING" },
            },
            required: ["category", "description"],
          },
          maxOutputTokens: 512,
        },
      }),
    });
  } catch {
    return send(res, 502, { error: "Gemini 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }

  if (!upstream.ok) {
    let upstreamCode = "";
    let upstreamMessage = "";
    try {
      const errorResponse = await upstream.json();
      upstreamCode = typeof errorResponse?.error?.status === "string" ? errorResponse.error.status : "";
      upstreamMessage = typeof errorResponse?.error?.message === "string" ? errorResponse.error.message : "";
    } catch {
      upstreamCode = "";
      upstreamMessage = "";
    }
    console.error("Gemini photo analysis failed", {
      requestId,
      model,
      status: upstream.status,
      code: upstreamCode || "UNKNOWN",
    });
    return send(res, upstream.status === 429 ? 429 : 502, {
      error: getErrorMessage(upstream.status, upstreamCode, upstreamMessage),
      requestId,
      ...(upstreamCode ? { upstreamCode } : {}),
    });
  }

  let result;
  try {
    result = await upstream.json();
  } catch {
    return send(res, 502, { error: "Gemini 분석 결과를 읽지 못했습니다. 다시 시도해 주세요." });
  }

  const responseParts = result?.candidates?.[0]?.content?.parts;
  const responseText = Array.isArray(responseParts)
    ? responseParts.map(part => typeof part?.text === "string" ? part.text : "").join("").trim()
    : "";
  if (!responseText) return send(res, 502, { error: "Gemini가 분석 결과를 반환하지 않았습니다. 다른 사진으로 다시 시도해 주세요." });

  let draft;
  try {
    draft = JSON.parse(responseText);
  } catch {
    return send(res, 502, { error: "Gemini 분석 결과 형식이 올바르지 않습니다. 다시 시도해 주세요." });
  }

  if (!draft || typeof draft !== "object" || Array.isArray(draft) || typeof draft.category !== "string" || typeof draft.description !== "string") {
    return send(res, 502, { error: "Gemini가 유효한 신고 초안을 만들지 못했습니다. 다시 시도해 주세요." });
  }

  const category = draft.category.trim();
  const description = draft.description.trim().slice(0, 1000);
  if (!CATEGORIES.includes(category) || !description) {
    return send(res, 502, { error: "Gemini가 유효한 신고 초안을 만들지 못했습니다. 다시 시도해 주세요." });
  }

  return send(res, 200, { category, description });
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
