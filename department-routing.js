(function (root, factory) {
  const routing = factory();
  if (typeof module === "object" && module.exports) module.exports = routing;
  else root.SalpisoDepartmentRouting = routing;
})(globalThis, function () {
  const FALLBACK_DEPARTMENT = "소통민원과 민원행정팀";
  const ROUTING_RULES = [
    {
      department: "도시디자인과 도시환경개선팀",
      categories: ["불법현수막"],
      keywords: ["불법현수막", "현수막", "옥외광고물", "불법광고물", "불법광고", "광고물"],
      duty: "옥외광고물 관리 및 정비",
    },
    {
      department: "교통정보운영과 교통시설팀",
      keywords: [
        "교통신호기",
        "보조신호기",
        "신호기",
        "신호등",
        "교통안전표지판",
        "안전표지판",
        "교통표지판",
        "교통안전시설물",
        "교통안전시설",
        "무인교통단속",
        "시각장애인 음향신호기",
      ],
      duty: "교통신호기·보조신호기 및 교통 관련 안전표지판·안전시설물 설치·보수",
    },
    {
      department: "물환경과 하수시설팀",
      keywords: [
        "공공하수도",
        "하수관로",
        "하수관",
        "하수도",
        "배수설비",
        "빗물받이덮개",
        "빗물받이",
        "우수관",
        "오수관",
        "하수구",
        "배수구",
        "맨홀",
      ],
      duty: "하수관로 유지·관리 및 공공하수도·배수설비 관련 업무",
    },
    {
      department: "도로과 도로정비팀",
      categories: ["도로 파손"],
      keywords: [
        "포트홀",
        "싱크홀",
        "차도포장",
        "도로포장",
        "기설도로",
        "도로파손",
        "차도파손",
        "포장면파손",
        "도로꺼짐",
        "도로침하",
        "도로균열",
        "노면파손",
        "노면패임",
      ],
      duty: "기설도로의 유지·관리",
    },
    {
      department: "도로과 도로정비팀",
      categories: ["안전봉 파손"],
      keywords: ["시선유도봉", "차량진입억제용단주", "안전봉", "볼라드"],
      duty: "자동차 진입억제용 단주(볼라드) 관련 업무 및 도로 부대시설 유지·관리",
    },
    {
      department: "도로과 도로정비팀",
      categories: ["보도블록 파손"],
      keywords: ["보도블록", "보도블럭", "보도침하", "보도들뜸", "보도파손", "보행로포장"],
      duty: "기설도로 및 도로 부대시설 유지·관리",
    },
    {
      department: "도로과 도로정비팀",
      categories: ["가로등 고장"],
      keywords: ["가로등", "보행등", "도로조명", "점등불량"],
      duty: "가로등 설치 및 유지·관리",
    },
    {
      department: "도로과 도로정비팀",
      keywords: ["도로표지판", "도로표지", "교량", "육교", "지하도", "고가도로"],
      duty: "도로 부대시설 설치 및 유지·관리",
    },
    {
      department: "공원조성과 공원시설팀",
      keywords: ["도시공원", "공원시설", "공원벤치", "공원놀이시설", "공원내시설", "유원지시설"],
      duty: "도시공원·유원지 시설물 정비",
    },
  ];

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[\s·ㆍ,./()[\]{}'"“”‘’_-]/g, "");
  }

  function fallback(reason) {
    return {
      department: FALLBACK_DEPARTMENT,
      routingReason: reason || "분장사무 기준으로 담당 부서를 특정하기 어려워 민원행정팀 재분류 대상으로 배부했습니다.",
    };
  }

  function assignDepartment(category, description) {
    const normalizedCategory = normalize(category);
    const normalizedDescription = normalize(description);
    const candidates = [];

    for (const rule of ROUTING_RULES) {
      const matchedKeyword = rule.keywords
        .map(keyword => ({ keyword, normalized: normalize(keyword) }))
        .filter(item => item.normalized && normalizedDescription.includes(item.normalized))
        .sort((left, right) => right.normalized.length - left.normalized.length)[0]?.keyword || "";
      const categoryMatches = (rule.categories || []).some(item => normalize(item) === normalizedCategory);
      if (!matchedKeyword && !categoryMatches) continue;

      candidates.push({
        rule,
        matchedKeyword,
        score: matchedKeyword ? 100 + normalize(matchedKeyword).length : 10,
      });
    }

    if (!candidates.length) return fallback();

    const departmentScores = new Map();
    for (const candidate of candidates) {
      departmentScores.set(
        candidate.rule.department,
        Math.max(departmentScores.get(candidate.rule.department) || 0, candidate.score)
      );
    }
    const highestScore = Math.max(...departmentScores.values());
    const topDepartments = [...departmentScores]
      .filter(([, score]) => score === highestScore)
      .map(([department]) => department);

    if (topDepartments.length !== 1) {
      return fallback("신고 내용에 서로 다른 부서 소관의 단서가 함께 있어 민원행정팀에서 담당 부서를 재분류하도록 배부했습니다.");
    }

    const department = topDepartments[0];
    const match = candidates
      .filter(candidate => candidate.rule.department === department && candidate.score === highestScore)
      .sort((left, right) => Number(Boolean(right.matchedKeyword)) - Number(Boolean(left.matchedKeyword)))[0];
    return {
      department,
      routingReason: match.matchedKeyword
        ? `신고 내용에서 '${match.matchedKeyword}'가 확인되어 분장사무 '${match.rule.duty}'에 따라 지정했습니다.`
        : `신고 유형 '${category}'에 따라 분장사무 '${match.rule.duty}'를 담당하는 팀으로 지정했습니다.`,
    };
  }

  return Object.freeze({ assignDepartment });
});
