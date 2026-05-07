import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedData } from "./seed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", ".data");
const dbPath = path.join(dataDir, "db.json");
const port = Number(process.env.PORT ?? 5174);

await ensureDatabase();

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[api] Oppor-Guardian API listening on http://127.0.0.1:${port}`);
});

async function route(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    return sendJson(res, 204, null);
  }

  if (method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "oppor-guardian-api" });
  }

  if (method === "GET" && url.pathname === "/api/bootstrap") {
    const db = await readDb();
    return sendJson(res, 200, buildBootstrap(db));
  }

  if (method === "PATCH" && url.pathname === "/api/me/profile") {
    const body = await readBody(req);
    const db = await readDb();
    db.profile = {
      ...db.profile,
      ...body,
      completion: calculateCompletion({ ...db.profile, ...body })
    };
    db.auditLogs.unshift(audit("PROFILE_UPDATED", { fields: Object.keys(body) }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  if (method === "POST" && url.pathname === "/api/recommendations/recalculate") {
    const db = await readDb();
    db.auditLogs.unshift(audit("RECOMMENDATIONS_RECALCULATED", { opportunityCount: db.opportunities.length }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  if (method === "POST" && url.pathname === "/api/saved-opportunities") {
    const body = await readBody(req);
    const db = await readDb();
    if (!db.savedOpportunityIds.includes(body.opportunityId)) {
      db.savedOpportunityIds.push(body.opportunityId);
    }
    db.auditLogs.unshift(audit("OPPORTUNITY_SAVED", { opportunityId: body.opportunityId }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  const savedDeleteMatch = url.pathname.match(/^\/api\/saved-opportunities\/([^/]+)$/);
  if (method === "DELETE" && savedDeleteMatch) {
    const opportunityId = decodeURIComponent(savedDeleteMatch[1]);
    const db = await readDb();
    db.savedOpportunityIds = db.savedOpportunityIds.filter((id) => id !== opportunityId);
    db.auditLogs.unshift(audit("OPPORTUNITY_UNSAVED", { opportunityId }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  const checklistMatch = url.pathname.match(/^\/api\/applications\/([^/]+)\/checklist$/);
  if (method === "PATCH" && checklistMatch) {
    const opportunityId = decodeURIComponent(checklistMatch[1]);
    const body = await readBody(req);
    const db = await readDb();
    const current = new Set(db.checkedDocs[opportunityId] ?? []);
    if (body.checked) {
      current.add(body.document);
    } else {
      current.delete(body.document);
    }
    db.checkedDocs[opportunityId] = [...current];
    db.auditLogs.unshift(audit("CHECKLIST_UPDATED", { opportunityId, document: body.document, checked: body.checked }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  const approveMatch = url.pathname.match(/^\/api\/admin\/extractions\/([^/]+)\/approve$/);
  if (method === "POST" && approveMatch) {
    const extractionId = decodeURIComponent(approveMatch[1]);
    const db = await readDb();
    const extraction = db.extractionQueue.find((item) => item.id === extractionId);
    if (!extraction) {
      return sendJson(res, 404, { error: "NOT_FOUND" });
    }
    if (extraction.status !== "APPROVED") {
      const id = `opp-${Date.now().toString(36)}`;
      db.opportunities.push({ id, ...extraction.draftOpportunity });
      extraction.status = "APPROVED";
      db.auditLogs.unshift(audit("EXTRACTION_APPROVED", { extractionId, opportunityId: id }));
    }
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  const rejectMatch = url.pathname.match(/^\/api\/admin\/extractions\/([^/]+)\/reject$/);
  if (method === "POST" && rejectMatch) {
    const extractionId = decodeURIComponent(rejectMatch[1]);
    const db = await readDb();
    const extraction = db.extractionQueue.find((item) => item.id === extractionId);
    if (!extraction) {
      return sendJson(res, 404, { error: "NOT_FOUND" });
    }
    extraction.status = "REJECTED";
    db.auditLogs.unshift(audit("EXTRACTION_REJECTED", { extractionId }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  if (method === "POST" && url.pathname === "/api/admin/sources/run") {
    const db = await readDb();
    await runSources(db, db.sources.filter((source) => source.status === "ACTIVE" || source.status === "NEEDS_KEY"));
    db.auditLogs.unshift(audit("SOURCE_RUN_COMPLETED", { sourceCount: db.sources.length }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  const sourceRunMatch = url.pathname.match(/^\/api\/admin\/sources\/([^/]+)\/run$/);
  if (method === "POST" && sourceRunMatch) {
    const sourceId = decodeURIComponent(sourceRunMatch[1]);
    const db = await readDb();
    const source = db.sources.find((item) => item.id === sourceId);
    if (!source) {
      return sendJson(res, 404, { error: "NOT_FOUND" });
    }
    await runSources(db, [source]);
    db.auditLogs.unshift(audit("SOURCE_RUN_COMPLETED", { sourceId }));
    await writeDb(db);
    return sendJson(res, 200, buildBootstrap(db));
  }

  return sendJson(res, 404, { error: "NOT_FOUND", path: url.pathname });
}

function buildBootstrap(db) {
  const recommendations = db.opportunities
    .map((opportunity) => ({
      ...opportunity,
      ...matchOpportunity(db.profile, opportunity)
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  const pendingExtractions = db.extractionQueue.filter((item) => item.status === "PENDING");

  return {
    profile: db.profile,
    opportunities: recommendations,
    savedOpportunityIds: db.savedOpportunityIds,
    checkedDocs: db.checkedDocs,
    admin: {
      todayCollected: 42 + db.opportunities.length,
      pendingReview: pendingExtractions.length,
      extractionFailures: db.crawlRuns.filter((run) => run.status === "FAILED").length,
      autoApprovalRate: calculateAutoApprovalRate(db),
      extractionQueue: pendingExtractions,
      sources: db.sources,
      crawlRuns: db.crawlRuns.slice(0, 10),
      auditLogs: db.auditLogs.slice(0, 8)
    }
  };
}

async function runSources(db, sources) {
  for (const source of sources) {
    const startedAt = new Date().toISOString();
    const run = {
      id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: source.id,
      sourceName: source.name,
      status: "RUNNING",
      startedAt,
      endedAt: null,
      foundCount: 0,
      newCount: 0,
      message: "수집 중"
    };
    db.crawlRuns.unshift(run);

    try {
      const result = source.type === "API" ? await runApiSource(source) : await runHtmlSource(source, db);
      run.status = result.status;
      run.foundCount = result.foundCount;
      run.newCount = result.newCount;
      run.message = result.message;
      source.status = result.sourceStatus;
      source.lastResult = result.message;
      source.coverage = result.coverage ?? source.coverage;
    } catch (error) {
      run.status = "FAILED";
      run.message = error instanceof Error ? error.message : "수집 실패";
      source.status = "BROKEN";
      source.lastResult = run.message;
    } finally {
      run.endedAt = new Date().toISOString();
      source.lastRunAt = run.endedAt;
    }
  }
}

async function runApiSource(source) {
  const keyBySource = {
    "src-youthcenter": "YOUTHCENTER_API_KEY",
    "src-gov24": "PUBLIC_SERVICE_API_KEY"
  };
  const envKey = keyBySource[source.id];
  if (envKey && !process.env[envKey]) {
    return {
      status: "FAILED",
      sourceStatus: "NEEDS_KEY",
      foundCount: 0,
      newCount: 0,
      coverage: 0,
      message: `${envKey} 환경변수가 없어 실제 API 호출을 건너뛰었습니다.`
    };
  }

  return {
    status: "SUCCESS",
    sourceStatus: "ACTIVE",
    foundCount: 0,
    newCount: 0,
    coverage: source.coverage,
    message: "API 키가 감지되었습니다. 실제 파서 연결 지점입니다."
  };
}

async function runHtmlSource(source, db) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "OpporGuardianMVP/0.1 (+local development; contact: admin@example.com)"
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  const candidates = extractHtmlCandidates(html, source).slice(0, 8);
  let newCount = 0;

  for (const candidate of candidates) {
    const dedupeKey = stableHash(`${source.id}:${candidate.title}:${candidate.url}`);
    const exists =
      db.extractionQueue.some((item) => item.dedupeKey === dedupeKey) ||
      db.opportunities.some((item) => item.source === candidate.url || item.title === candidate.title);
    if (exists) {
      continue;
    }

    db.extractionQueue.unshift({
      id: `ext-live-${dedupeKey}`,
      dedupeKey,
      title: candidate.title,
      organization: source.organization,
      source: `${source.name} · 실제 HTML`,
      sourceUrl: candidate.url,
      confidence: candidate.confidence,
      missing: candidate.missing,
      status: "PENDING",
      draftOpportunity: inferDraftOpportunity(candidate, source)
    });
    newCount += 1;
  }

  return {
    status: "SUCCESS",
    sourceStatus: "ACTIVE",
    foundCount: candidates.length,
    newCount,
    coverage: Math.min(98, Math.max(source.coverage ?? 0, 60 + newCount * 4)),
    message: `${candidates.length}개 후보 발견, ${newCount}개 신규 검수 큐 등록`
  };
}

function extractHtmlCandidates(html, source) {
  const candidates = [];
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const keywordRegex = /(장학|장학생|지원금|지원사업|청년|대학생|생활비|주거|월세|연수|멘토)/;
  const seen = new Set();
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const title = cleanHtml(match[2]);
    if (title.length < 6 || title.length > 90 || !keywordRegex.test(title)) {
      continue;
    }
    const normalized = title.replace(/\s+/g, " ");
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    candidates.push({
      title: normalized,
      url: resolveUrl(source.url, href),
      confidence: normalized.includes("장학") ? 0.74 : 0.62,
      missing: normalized.includes("마감") ? "자격요건 구조화" : "마감일/자격요건 구조화"
    });
  }

  if (candidates.length === 0) {
    const text = cleanHtml(html);
    for (const fragment of text.split(/[.\n]/).map((item) => item.trim())) {
      if (fragment.length >= 10 && fragment.length <= 90 && keywordRegex.test(fragment) && !seen.has(fragment)) {
        seen.add(fragment);
        candidates.push({
          title: fragment,
          url: source.url,
          confidence: 0.52,
          missing: "링크/마감일/자격요건 구조화"
        });
      }
      if (candidates.length >= 8) {
        break;
      }
    }
  }

  return candidates;
}

function inferDraftOpportunity(candidate, source) {
  const title = candidate.title;
  const category = title.includes("월세") || title.includes("주거") ? "주거비" : title.includes("연수") || title.includes("멘토") || title.includes("교육") ? "교육/연수" : title.includes("생활비") ? "생활비" : "장학금";
  const regionKeywords = inferRegionKeywords(`${title} ${source.organization}`);
  const majorKeywords = inferMajorKeywords(title);

  return {
    title,
    organization: source.organization,
    region: regionKeywords.includes("전국") ? "전국" : regionKeywords.join(" "),
    schoolScope: title.includes("대학원") ? "대학원생" : "대학생/청년",
    category,
    benefitType: category === "주거비" ? "주거비 지원" : category === "교육/연수" ? "교육/활동 지원" : "장학금",
    amountText: inferAmountText(title),
    amountMax: inferAmountMax(title),
    deadline: "기관 공고 확인 필요",
    dday: 30,
    sourceType: "실제 HTML 수집",
    documents: ["공고 원문 확인", "신청서", "재학/재적 증명", "자격 증빙"],
    source: candidate.url,
    rules: {
      regionKeywords,
      schoolAny: true,
      minGpa: title.includes("성적") || title.includes("우수") ? 3 : null,
      maxIncomeBracket: title.includes("저소득") || title.includes("소득") ? 5 : null,
      majorKeywords,
      requiredUnknowns: ["마감일", "세부 자격요건", "중복수혜 조건"],
      warnings: ["실제 수집 후보이므로 운영자 검수 후 추천에 반영해야 합니다."]
    }
  };
}

function matchOpportunity(profile, opportunity) {
  const rules = opportunity.rules ?? {};
  const reasons = [];
  let unknowns = [...(rules.requiredUnknowns ?? [])];
  const warnings = [...(rules.warnings ?? [])];
  const blockers = [];
  let score = 30;
  let confidence = 0.72;

  const regionText = `${profile.residence} ${profile.hometown}`;
  const regionKeywords = rules.regionKeywords ?? ["전국"];
  const regionPass = regionKeywords.includes("전국") || regionKeywords.some((keyword) => regionText.includes(keyword));
  if (regionPass) {
    score += 22;
    confidence += 0.05;
    reasons.push(regionKeywords.includes("전국") ? "전국 대상 공고라 지역 제한이 낮습니다." : "입력한 거주지/출신지역이 지역 조건과 관련성이 높습니다.");
    if (String(profile.residenceMonths ?? "").includes("6개월") || String(profile.residenceMonths ?? "").includes("1년") || String(profile.residenceMonths ?? "").includes("3년")) {
      unknowns = unknowns.filter((item) => !item.includes("거주"));
      score += 5;
      reasons.push(`거주기간 선택값(${profile.residenceMonths})이 지역 장학금 판단에 도움이 됩니다.`);
    }
  } else {
    blockers.push(`지역 조건(${regionKeywords.join(", ")})과 현재 프로필이 일치하지 않습니다.`);
  }

  const majorKeywords = rules.majorKeywords ?? [];
  const majorPass = majorKeywords.length === 0 || majorKeywords.some((keyword) => profile.major.includes(keyword));
  if (majorPass) {
    score += majorKeywords.length === 0 ? 12 : 18;
    reasons.push(majorKeywords.length === 0 ? "전공 제한이 없거나 넓게 해석됩니다." : "전공 조건과 현재 전공이 일치합니다.");
  } else {
    blockers.push(`전공 조건(${majorKeywords.join(", ")})과 현재 전공이 일치하지 않습니다.`);
  }

  const gpa = parseNumber(profile.gpa);
  if (rules.minGpa) {
    if (gpa === null) {
      unknowns.push("직전학기 성적 확인");
      score -= 4;
    } else if (gpa >= rules.minGpa) {
      score += 14;
      reasons.push(`직전학기 성적이 최소 기준 ${rules.minGpa} 이상입니다.`);
    } else {
      blockers.push(`성적 기준 ${rules.minGpa} 이상을 충족하지 못할 수 있습니다.`);
    }
  } else {
    score += 8;
  }

  const incomeBracket = parseIncomeBracket(profile.incomeBracket);
  if (rules.maxIncomeBracket) {
    if (incomeBracket !== null && incomeBracket <= rules.maxIncomeBracket) {
      score += 12;
      reasons.push(`소득구간이 ${rules.maxIncomeBracket}구간 이하 조건과 맞습니다.`);
    } else {
      unknowns.push("소득/재산 기준 추가 확인");
      score -= 6;
    }
  }

  if (opportunity.dday <= 7) {
    score += 4;
  }

  const preference = String(profile.benefitPreference ?? "");
  if ((preference.includes("생활비") && opportunity.category === "생활비") || (preference.includes("주거비") && opportunity.category === "주거비") || (preference.includes("교육") && opportunity.category === "교육/연수")) {
    score += 7;
    reasons.push("선택한 우선 혜택과 공고 유형이 일치합니다.");
  }

  const specialConditions = Array.isArray(profile.specialConditions) ? profile.specialConditions : [];
  if (specialConditions.includes("지역인재") && !regionKeywords.includes("전국")) {
    score += 4;
    reasons.push("지역인재 관심 조건과 지역 공고가 맞습니다.");
  }
  if (specialConditions.includes("소득연계 관심") && rules.maxIncomeBracket) {
    score += 4;
    reasons.push("소득연계 관심 조건과 소득 기준 공고가 맞습니다.");
  }
  if (specialConditions.includes("창업/IT") && majorKeywords.some((keyword) => ["AI", "컴퓨터", "소프트웨어", "공학"].includes(keyword))) {
    score += 5;
    reasons.push("창업/IT 관심 조건과 전공/분야 조건이 맞습니다.");
  }

  score -= unknowns.length * 3;
  score -= blockers.length * 28;
  score = Math.max(5, Math.min(96, score));
  confidence = Math.max(0.48, Math.min(0.94, confidence - unknowns.length * 0.02 - blockers.length * 0.08));

  let status = "지원가능";
  if (blockers.length > 0) {
    status = "지원불가";
  } else if (unknowns.length >= 2 || score < 78) {
    status = "조건부가능";
  } else if (confidence < 0.7) {
    status = "확인필요";
  }

  return {
    matchScore: score,
    confidence,
    status,
    reasons,
    unknowns,
    warnings,
    blockers
  };
}

function calculateCompletion(profile) {
  const fields = ["school", "status", "grade", "major", "residence", "hometown", "gpa", "incomeBracket", "residenceMonths", "benefitPreference"];
  const filled = fields.filter((field) => String(profile[field] ?? "").trim().length > 0).length;
  return Math.max(20, Math.round((filled / fields.length) * 92));
}

function calculateAutoApprovalRate(db) {
  const total = db.extractionQueue.length;
  if (total === 0) {
    return 100;
  }
  const highConfidence = db.extractionQueue.filter((item) => item.confidence >= 0.86).length;
  return Math.round((highConfidence / total) * 100);
}

function parseNumber(value) {
  const match = String(value ?? "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseIncomeBracket(value) {
  const text = String(value ?? "");
  if (text.includes("기초") || text.includes("차상위")) {
    return 0;
  }
  if (text.includes("모름")) {
    return null;
  }
  return parseNumber(text);
}

function cleanHtml(input) {
  return String(input ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

function inferRegionKeywords(text) {
  const regions = ["마포구", "은평구", "서울", "충남", "충청남도", "천안시", "아산시", "부산", "강원", "전남", "전라남도"];
  const matched = regions.filter((region) => text.includes(region));
  return matched.length > 0 ? matched : ["전국"];
}

function inferMajorKeywords(text) {
  const majorMap = [
    ["보건", ["보건", "간호", "의학", "약학"]],
    ["간호", ["간호"]],
    ["공학", ["공학", "컴퓨터", "소프트웨어"]],
    ["AI", ["AI", "인공지능", "컴퓨터", "소프트웨어"]],
    ["예술", ["예술", "디자인", "미술", "음악"]]
  ];
  for (const [keyword, majors] of majorMap) {
    if (text.includes(keyword)) {
      return majors;
    }
  }
  return [];
}

function inferAmountText(text) {
  const amountMatch = text.match(/(\d{2,4})\s*만\s*원/);
  if (amountMatch) {
    return `${amountMatch[1]}만원`;
  }
  const usdMatch = text.match(/USD\s*[\d,]+/i);
  if (usdMatch) {
    return usdMatch[0].toUpperCase();
  }
  return "기관 확인 필요";
}

function inferAmountMax(text) {
  const amountMatch = text.match(/(\d{2,4})\s*만\s*원/);
  if (amountMatch) {
    return Number(amountMatch[1]) * 10000;
  }
  return 0;
}

function stableHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function audit(action, payload) {
  return {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    payload,
    actor: "local-mvp",
    createdAt: new Date().toISOString()
  };
}

async function ensureDatabase() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    await writeFile(dbPath, JSON.stringify(seedData, null, 2), "utf8");
  }
}

async function readDb() {
  const content = await readFile(dbPath, "utf8");
  return normalizeDb(JSON.parse(content));
}

async function writeDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function normalizeDb(db) {
  return {
    ...db,
    profile: {
      ...seedData.profile,
      ...db.profile
    },
    sources: db.sources ?? seedData.sources,
    crawlRuns: db.crawlRuns ?? [],
    opportunities: db.opportunities ?? seedData.opportunities,
    extractionQueue: db.extractionQueue ?? seedData.extractionQueue,
    savedOpportunityIds: db.savedOpportunityIds ?? [],
    checkedDocs: db.checkedDocs ?? {},
    auditLogs: db.auditLogs ?? []
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  if (statusCode === 204) {
    res.end();
  } else {
    res.end(JSON.stringify(payload));
  }
}
