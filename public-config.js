function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

module.exports = function handler(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== String(req.headers.host || "").toLowerCase()) {
        return send(res, 403, { error: "Cross-origin requests are not allowed." });
      }
    } catch {
      return send(res, 403, { error: "Invalid request origin." });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed." });
  }

  return send(res, 200, {
    kakaoMapAppKey: process.env.KAKAO_MAP_APP_KEY?.trim() || "",
  });
};
