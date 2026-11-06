const { randomUUID } = require("node:crypto");
const { assignDepartment } = require("../department-routing");

const BUCKET = "salpiso-photos";
const MAX_PHOTOS = 4;
const MAX_TOTAL_BASE64_BYTES = 3_000_000;
const CATEGORIES = new Set([
  "불법현수막",
  "불법 쓰레기",
  "도로 파손",
  "안전봉 파손",
  "보도블록 파손",
  "가로등 고장",
  "기타 시설물",
]);
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

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(options.body && !(options.body instanceof Buffer) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error("Supabase request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function parsePhoto(photo) {
  if (!photo || typeof photo.dataUrl !== "string") return null;
  const match = photo.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
    extension: match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg",
  };
}

async function removeUploadedFiles(config, paths) {
  if (!paths.length) return;
  try {
    await supabaseRequest(config, `/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      body: JSON.stringify({ prefixes: paths }),
    });
  } catch {
    // A failed cleanup is harmless to the report transaction; orphan cleanup can be done in Storage.
  }
}

module.exports = async function handler(req, res) {
  if (!isSameOrigin(req)) return send(res, 403, { error: "Cross-origin requests are not allowed." });
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  const config = getConfig();
  if (!config) return send(res, 503, { error: "Supabase environment variables are not configured." });

  if (req.method === "GET") {
    try {
      const query = new URLSearchParams({
        select: "report_no,category,title,area,address,department,routing_reason,status,description,urgency,latitude,longitude,photo_paths,created_at",
        order: "created_at.desc",
        limit: "100",
      });
      const rows = await supabaseRequest(config, `/rest/v1/reports?${query}`);
      return send(res, 200, rows || []);
    } catch {
      return send(res, 502, { error: "신고 목록을 데이터베이스에서 불러오지 못했습니다." });
    }
  }

  const input = req.body;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return send(res, 400, { error: "Invalid request body." });
  }

  const category = String(input.category || "").trim();
  const address = String(input.address || "").trim().slice(0, 500);
  const description = String(input.description || "").trim().slice(0, 3000);
  const urgency = ["일반", "긴급", "안전 위험"].includes(input.urgency) ? input.urgency : "일반";
  const latitudeValue = input.latitude === null || input.latitude === undefined || input.latitude === "" ? null : Number(input.latitude);
  const longitudeValue = input.longitude === null || input.longitude === undefined || input.longitude === "" ? null : Number(input.longitude);
  const latitude = Number.isFinite(latitudeValue) && latitudeValue >= -90 && latitudeValue <= 90 ? latitudeValue : null;
  const longitude = Number.isFinite(longitudeValue) && longitudeValue >= -180 && longitudeValue <= 180 ? longitudeValue : null;
  const photos = Array.isArray(input.photos) ? input.photos : [];

  if (!CATEGORIES.has(category) || !address || !description) {
    return send(res, 400, { error: "신고 유형, 주소, 신고 내용을 확인해 주세요." });
  }
  if (photos.length < 1 || photos.length > MAX_PHOTOS) {
    return send(res, 400, { error: `사진은 1장 이상 ${MAX_PHOTOS}장 이하로 첨부해 주세요.` });
  }

  const parsedPhotos = photos.map(parsePhoto);
  if (parsedPhotos.some(photo => !photo)) {
    return send(res, 400, { error: "JPG, PNG 또는 WebP 사진만 등록할 수 있습니다." });
  }
  const totalBase64Bytes = photos.reduce((total, photo) => total + Buffer.byteLength(photo.dataUrl, "utf8"), 0);
  if (totalBase64Bytes > MAX_TOTAL_BASE64_BYTES) {
    return send(res, 413, { error: "사진 용량이 큽니다. 사진 수를 줄이거나 다시 촬영해 주세요." });
  }

  const uploadedPaths = [];
  const assignment = assignDepartment(category, description);
  try {
    for (const photo of parsedPhotos) {
      const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${photo.extension}`;
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodedPath}`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": photo.contentType,
          "x-upsert": "false",
        },
        body: photo.buffer,
      });
      if (!response.ok) {
        const error = new Error("Photo upload failed.");
        error.status = response.status;
        throw error;
      }
      uploadedPaths.push(path);
    }

    const reportNo = `SP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const area = address.split(/\s+/).slice(-2).join(" ").slice(0, 100);
    const row = {
      report_no: reportNo,
      category,
      title: `${category} 신고`,
      area,
      address,
      department: assignment.department,
      routing_reason: assignment.routingReason,
      status: "waiting",
      description,
      urgency,
      latitude,
      longitude,
      photo_paths: uploadedPaths,
    };
    const inserted = await supabaseRequest(config, "/rest/v1/reports?select=report_no,category,title,area,address,department,routing_reason,status,description,urgency,latitude,longitude,photo_paths,created_at", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return send(res, 201, inserted[0]);
  } catch (error) {
    await removeUploadedFiles(config, uploadedPaths);
    if (error.status === 413) return send(res, 413, { error: "사진 업로드 용량 제한을 초과했습니다." });
    return send(res, 502, { error: "신고를 저장하지 못했습니다. 데이터베이스와 사진 저장소 설정을 확인해 주세요." });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
