const { randomUUID } = require("node:crypto");

const BUCKET = "salpiso-photos";
const MAX_PHOTOS = 4;
const MAX_TOTAL_BASE64_BYTES = 3_000_000;
const CATEGORIES = new Set([
  "불법현수막",
  "도로 파손",
  "안전봉 파손",
  "보도블록 파손",
  "가로등 고장",
  "기타 시설물",
]);
const ROUTING_RULES = [
  {
    department: "도시디자인과 도시환경개선팀",
    category: "불법현수막",
    keywords: ["현수막", "옥외광고물", "불법광고물", "광고물"],
    duty: "옥외광고물 관리 및 정비",
  },
  {
    department: "교통정보운영과 교통시설팀",
    keywords: ["신호등", "신호기", "교통표지판", "안전표지판", "교통안전시설", "보조신호기"],
    duty: "교통신호기 및 교통 관련 안전표지판·안전시설물 설치·보수",
  },
  {
    department: "물환경과 하수시설팀",
    keywords: ["하수도", "하수관", "하수관로", "배수설비", "배수구", "빗물받이", "우수관", "오수관", "맨홀"],
    duty: "하수도 및 하수관로 유지·관리",
  },
  {
    department: "도로과 도로정비팀",
    category: "도로 파손",
    keywords: ["도로 파손", "포트홀", "싱크홀", "차도 파손", "포장면 파손", "도로 꺼짐", "도로 침하"],
    duty: "기설도로 유지·관리",
  },
  {
    department: "도로과 도로정비팀",
    category: "안전봉 파손",
    keywords: ["안전봉", "시선유도봉", "볼라드", "차량 진입억제용 단주"],
    duty: "자동차 진입억제용 단주(볼라드) 관련 업무 및 도로 부대시설 유지·관리",
  },
  {
    department: "도로과 도로정비팀",
    category: "보도블록 파손",
    keywords: ["보도블록", "보도 파손", "보도 침하", "보도 들뜸", "보행로 포장"],
    duty: "기설도로 및 도로 부대시설 유지·관리",
  },
  {
    department: "도로과 도로정비팀",
    category: "가로등 고장",
    keywords: ["가로등", "도로 조명", "보행등", "점등 불량"],
    duty: "가로등 설치 및 유지·관리",
  },
  {
    department: "도로과 도로정비팀",
    keywords: ["도로 부대시설", "도로표지판", "교량", "육교", "지하도", "고가도로"],
    duty: "도로 부대시설 설치 및 유지·관리",
  },
];

function assignDepartment(category, description) {
  const normalizedDescription = String(description || "").replace(/\s+/g, " ").trim();
  const candidates = ROUTING_RULES.flatMap(rule => {
    const matchedKeyword = rule.keywords.find(keyword => normalizedDescription.includes(keyword));
    const categoryMatches = rule.category === category;
    if (!matchedKeyword && !categoryMatches) return [];
    return [{ rule, score: matchedKeyword ? 4 : categoryMatches ? 2 : 0, matchedKeyword }];
  }).sort((left, right) => right.score - left.score);
  const descriptionCandidates = candidates.filter(candidate => candidate.matchedKeyword);
  const rankedCandidates = descriptionCandidates.length ? descriptionCandidates : candidates;
  const departmentScores = new Map();
  for (const candidate of rankedCandidates) {
    departmentScores.set(candidate.rule.department, Math.max(departmentScores.get(candidate.rule.department) || 0, candidate.score));
  }
  const highestScore = Math.max(0, ...departmentScores.values());
  const topDepartments = [...departmentScores].filter(([, score]) => score === highestScore);

  if (topDepartments.length === 1) {
    const department = topDepartments[0][0];
    const { rule, matchedKeyword } = rankedCandidates.find(candidate => candidate.rule.department === department && candidate.score === highestScore);
    const evidence = matchedKeyword ? `신고 내용의 '${matchedKeyword}'` : `신고 유형 '${category}'`;
    return {
      department,
      routingReason: `${evidence}이(가) 분장사무 '${rule.duty}'에 해당합니다.`,
    };
  }

  return {
    department: "소통민원과 민원관리팀",
    routingReason: "분장사무상 상담민원 접수·배분·관리 담당으로 우선 배부했습니다. 담당 업무를 확인한 뒤 소관 부서로 재배부해 주세요.",
  };
}

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

module.exports.assignDepartment = assignDepartment;
