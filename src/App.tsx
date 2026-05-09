import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileCheck2,
  Filter,
  GraduationCap,
  Home,
  Info,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  X
} from "lucide-react";

type ViewKey = "dashboard" | "recommendations" | "saved" | "profile" | "admin";
type MatchStatus = "지원가능" | "조건부가능" | "확인필요" | "지원불가";
type Category = "전체" | "장학금" | "생활비" | "주거비" | "교육/연수" | "공모전";
type ApplicationStatus = "검토중" | "서류준비" | "작성중" | "제출완료";

type Opportunity = {
  id: string;
  title: string;
  organization: string;
  region: string;
  schoolScope: string;
  category: Exclude<Category, "전체">;
  benefitType: string;
  amountText: string;
  amountMax: number;
  deadline: string;
  dday: number;
  matchScore: number;
  confidence: number;
  status: MatchStatus;
  sourceType: string;
  reasons: string[];
  unknowns: string[];
  warnings: string[];
  documents: string[];
  source: string;
  contestFields?: string[];
  submissionTypes?: string[];
  teamMode?: string;
  difficulty?: string;
  portfolioValue?: string;
  prizeText?: string;
};

type ExtractionItem = {
  id: string;
  title: string;
  organization: string;
  source: string;
  confidence: number;
  missing: string;
  status: string;
};

type AuditLog = {
  id: string;
  action: string;
  createdAt: string;
};

type SourceItem = {
  id: string;
  name: string;
  type: "API" | "HTML" | "MANUAL";
  organization: string;
  url: string;
  status: "ACTIVE" | "NEEDS_KEY" | "BROKEN" | "PAUSED";
  priority: number;
  lastRunAt: string | null;
  lastResult: string;
  coverage: number;
  notes: string;
};

type CrawlRun = {
  id: string;
  sourceId: string;
  sourceName: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  endedAt: string | null;
  foundCount: number;
  newCount: number;
  message: string;
};

type AdminData = {
  todayCollected: number;
  pendingReview: number;
  extractionFailures: number;
  autoApprovalRate: number;
  extractionQueue: ExtractionItem[];
  sources: SourceItem[];
  crawlRuns: CrawlRun[];
  auditLogs: AuditLog[];
};

type BootstrapPayload = {
  profile: Profile;
  opportunities: Opportunity[];
  savedOpportunityIds: string[];
  checkedDocs: Record<string, string[]>;
  applications: Record<string, ApplicationPlan>;
  admin: AdminData;
};

type Profile = {
  school: string;
  status: string;
  grade: string;
  major: string;
  residence: string;
  hometown: string;
  gpa: string;
  incomeBracket: string;
  residenceMonths: string;
  benefitPreference: string;
  specialConditions: string[];
  contestInterests: string[];
  skills: string[];
  teamPreference: string;
  weeklyHours: string;
  contestGoal: string;
  completion: number;
};

type ManualContestDraft = {
  title: string;
  organization: string;
  url: string;
};

type ApplicationPlan = {
  status: ApplicationStatus;
  reminderEnabled: boolean;
  updatedAt: string | null;
};

const initialProfile: Profile = {
  school: "한국대학교",
  status: "재학",
  grade: "3학년",
  major: "컴퓨터공학과",
  residence: "서울특별시 마포구",
  hometown: "충청남도 천안시",
  gpa: "3.8 / 4.5",
  incomeBracket: "3구간",
  residenceMonths: "6개월 이상",
  benefitPreference: "생활비/주거비 우선",
  specialConditions: ["지역인재", "소득연계 관심"],
  contestInterests: ["IT/소프트웨어", "창업/아이디어"],
  skills: ["개발", "기획", "발표"],
  teamPreference: "팀 가능",
  weeklyHours: "주 5~10시간",
  contestGoal: "포트폴리오",
  completion: 78
};

const CATEGORY_OPTIONS: Category[] = ["전체", "장학금", "생활비", "주거비", "교육/연수", "공모전"];

const CONTEST_INTEREST_OPTIONS = [
  "IT/소프트웨어",
  "AI/데이터",
  "창업/아이디어",
  "기획/마케팅",
  "디자인/브랜딩",
  "영상/콘텐츠",
  "글쓰기/논문",
  "사회문제/공익",
  "환경/에너지",
  "금융/경제",
  "지역/관광",
  "게임/메타버스"
];

const SKILL_OPTIONS = ["기획", "개발", "데이터분석", "디자인", "영상편집", "글쓰기", "발표", "리서치", "마케팅", "PM", "창업 경험", "외국어"];

const UNIVERSITY_OPTIONS = [
  "가야대학교",
  "가천대학교",
  "가톨릭관동대학교",
  "가톨릭대학교",
  "감리교신학대학교",
  "강남대학교",
  "강릉원주대학교",
  "강서대학교",
  "강원대학교",
  "건국대학교",
  "건국대학교 글로컬캠퍼스",
  "건양대학교",
  "경기대학교",
  "경남대학교",
  "경동대학교",
  "경북대학교",
  "경상국립대학교",
  "경성대학교",
  "경운대학교",
  "경일대학교",
  "경희대학교",
  "계명대학교",
  "고려대학교",
  "고려대학교 세종캠퍼스",
  "고신대학교",
  "공주대학교",
  "광운대학교",
  "광주대학교",
  "광주여자대학교",
  "국민대학교",
  "군산대학교",
  "극동대학교",
  "금오공과대학교",
  "김천대학교",
  "나사렛대학교",
  "남서울대학교",
  "단국대학교",
  "대구가톨릭대학교",
  "대구대학교",
  "대구한의대학교",
  "대전대학교",
  "대진대학교",
  "덕성여자대학교",
  "동국대학교",
  "동국대학교 WISE캠퍼스",
  "동덕여자대학교",
  "동명대학교",
  "동서대학교",
  "동아대학교",
  "동양대학교",
  "동의대학교",
  "루터대학교",
  "명지대학교",
  "목원대학교",
  "목포대학교",
  "배재대학교",
  "백석대학교",
  "부경대학교",
  "부산가톨릭대학교",
  "부산대학교",
  "부산외국어대학교",
  "삼육대학교",
  "상명대학교",
  "상지대학교",
  "서강대학교",
  "서경대학교",
  "서울과학기술대학교",
  "서울교육대학교",
  "서울대학교",
  "서울시립대학교",
  "서울신학대학교",
  "서울여자대학교",
  "서원대학교",
  "선문대학교",
  "성결대학교",
  "성공회대학교",
  "성균관대학교",
  "성신여자대학교",
  "세명대학교",
  "세종대학교",
  "수원대학교",
  "숙명여자대학교",
  "순천대학교",
  "순천향대학교",
  "숭실대학교",
  "신라대학교",
  "아주대학교",
  "안동대학교",
  "안양대학교",
  "연세대학교",
  "연세대학교 미래캠퍼스",
  "영남대학교",
  "우석대학교",
  "우송대학교",
  "울산대학교",
  "원광대학교",
  "이화여자대학교",
  "인제대학교",
  "인천대학교",
  "인하대학교",
  "전남대학교",
  "전북대학교",
  "제주대학교",
  "조선대학교",
  "중앙대학교",
  "차의과학대학교",
  "창원대학교",
  "청주대학교",
  "충남대학교",
  "충북대학교",
  "한국공학대학교",
  "한국교원대학교",
  "한국교통대학교",
  "한국기술교육대학교",
  "한국외국어대학교",
  "한국체육대학교",
  "한국항공대학교",
  "한남대학교",
  "한동대학교",
  "한라대학교",
  "한림대학교",
  "한밭대학교",
  "한서대학교",
  "한성대학교",
  "한세대학교",
  "한신대학교",
  "한양대학교",
  "한양대학교 ERICA",
  "협성대학교",
  "호서대학교",
  "홍익대학교"
].sort((a, b) => a.localeCompare(b, "ko"));

const MAJOR_OPTIONS = [
  "AI학과",
  "간호학과",
  "건축공학과",
  "건축학과",
  "게임공학과",
  "경영정보학과",
  "경영학과",
  "경제학과",
  "경찰행정학과",
  "광고홍보학과",
  "관광경영학과",
  "교육학과",
  "국어국문학과",
  "국제통상학과",
  "글로벌비즈니스학과",
  "기계공학과",
  "기독교학과",
  "농업경제학과",
  "도시공학과",
  "동물자원학과",
  "디자인학과",
  "디지털미디어학과",
  "무역학과",
  "문예창작학과",
  "문화콘텐츠학과",
  "물리학과",
  "미디어커뮤니케이션학과",
  "미술학과",
  "바이오메디컬공학과",
  "반도체공학과",
  "법학과",
  "보건행정학과",
  "부동산학과",
  "불어불문학과",
  "빅데이터학과",
  "사학과",
  "사회복지학과",
  "사회학과",
  "산업공학과",
  "상담심리학과",
  "생명공학과",
  "생명과학과",
  "서양화과",
  "섬유공학과",
  "소프트웨어학과",
  "소방방재학과",
  "수의학과",
  "수학과",
  "스마트팜학과",
  "스포츠과학과",
  "시각디자인학과",
  "식품공학과",
  "식품영양학과",
  "신소재공학과",
  "심리학과",
  "약학과",
  "언론정보학과",
  "에너지공학과",
  "역사교육과",
  "영어교육과",
  "영어영문학과",
  "유아교육과",
  "음악학과",
  "응급구조학과",
  "의공학과",
  "의류학과",
  "의예과",
  "일본학과",
  "자동차공학과",
  "전공무관",
  "전기공학과",
  "전자공학과",
  "정보보호학과",
  "정치외교학과",
  "조경학과",
  "중국학과",
  "지리학과",
  "철학과",
  "체육교육과",
  "초등교육과",
  "컴퓨터공학과",
  "토목공학과",
  "통계학과",
  "패션디자인학과",
  "항공서비스학과",
  "항공우주공학과",
  "해양공학과",
  "행정학과",
  "호텔경영학과",
  "화학공학과",
  "화학과",
  "환경공학과",
  "회계학과"
].sort((a, b) => a.localeCompare(b, "ko"));

const REGION_GROUPS: Record<string, string[]> = {
  "강원특별자치도": ["강릉시", "동해시", "삼척시", "속초시", "원주시", "춘천시", "태백시", "고성군", "양구군", "양양군", "영월군", "인제군", "정선군", "철원군", "평창군", "홍천군", "화천군", "횡성군"],
  "경기도": ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "김포시", "광명시", "광주시", "군포시", "하남시", "오산시", "양주시", "이천시", "구리시", "안성시", "포천시", "의왕시", "여주시", "동두천시", "과천시", "가평군", "양평군", "연천군"],
  "경상남도": ["거제시", "김해시", "밀양시", "사천시", "양산시", "진주시", "창원시", "통영시", "거창군", "고성군", "남해군", "산청군", "의령군", "창녕군", "하동군", "함안군", "함양군", "합천군"],
  "경상북도": ["경산시", "경주시", "구미시", "김천시", "문경시", "상주시", "안동시", "영주시", "영천시", "포항시", "고령군", "봉화군", "성주군", "영덕군", "영양군", "예천군", "울릉군", "울진군", "의성군", "청도군", "청송군", "칠곡군"],
  "광주광역시": ["광산구", "남구", "동구", "북구", "서구"],
  "대구광역시": ["군위군", "남구", "달서구", "달성군", "동구", "북구", "서구", "수성구", "중구"],
  "대전광역시": ["대덕구", "동구", "서구", "유성구", "중구"],
  "부산광역시": ["강서구", "금정구", "기장군", "남구", "동구", "동래구", "부산진구", "북구", "사상구", "사하구", "서구", "수영구", "연제구", "영도구", "중구", "해운대구"],
  "서울특별시": ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구"],
  "세종특별자치시": ["세종특별자치시"],
  "울산광역시": ["남구", "동구", "북구", "울주군", "중구"],
  "인천광역시": ["강화군", "계양구", "남동구", "동구", "미추홀구", "부평구", "서구", "연수구", "옹진군", "중구"],
  "전라남도": ["광양시", "나주시", "목포시", "순천시", "여수시", "강진군", "고흥군", "곡성군", "구례군", "담양군", "무안군", "보성군", "신안군", "영광군", "영암군", "완도군", "장성군", "장흥군", "진도군", "함평군", "해남군", "화순군"],
  "전북특별자치도": ["군산시", "김제시", "남원시", "익산시", "전주시", "정읍시", "고창군", "무주군", "부안군", "순창군", "완주군", "임실군", "장수군", "진안군"],
  "제주특별자치도": ["서귀포시", "제주시"],
  "충청남도": ["계룡시", "공주시", "논산시", "당진시", "보령시", "서산시", "아산시", "천안시", "금산군", "부여군", "서천군", "예산군", "청양군", "태안군", "홍성군"],
  "충청북도": ["제천시", "청주시", "충주시", "괴산군", "단양군", "보은군", "영동군", "옥천군", "음성군", "증평군", "진천군"]
};

const currencyFormatter = new Intl.NumberFormat("ko-KR");
const APPLICATION_STATUSES: ApplicationStatus[] = ["검토중", "서류준비", "작성중", "제출완료"];

const emptyAdmin: AdminData = {
  todayCollected: 0,
  pendingReview: 0,
  extractionFailures: 0,
  autoApprovalRate: 0,
  extractionQueue: [],
  sources: [],
  crawlRuns: [],
  auditLogs: []
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function toCheckedDocSets(checkedDocs: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(checkedDocs).map(([key, value]) => [key, new Set(value)])) as Record<string, Set<string>>;
}

function defaultApplicationPlan(): ApplicationPlan {
  return {
    status: "검토중",
    reminderEnabled: false,
    updatedAt: null
  };
}

function normalizeProfileForUi(profile: Profile): Profile {
  return {
    ...profile,
    grade: normalizeGrade(profile.grade)
  };
}

function normalizeGrade(grade: string) {
  if (grade.includes("1학년")) {
    return "1학년";
  }
  if (grade.includes("2학년")) {
    return "2학년";
  }
  if (grade.includes("3학년")) {
    return "3학년";
  }
  if (grade.includes("4학년")) {
    return "4학년";
  }
  return grade || "1학년";
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("profile");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("전체");
  const [selectedId, setSelectedId] = useState("opp-001");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [checkedDocs, setCheckedDocs] = useState<Record<string, Set<string>>>({});
  const [applications, setApplications] = useState<Record<string, ApplicationPlan>>({});
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [admin, setAdmin] = useState<AdminData>(emptyAdmin);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  function applyBootstrap(payload: BootstrapPayload) {
    setProfile(normalizeProfileForUi(payload.profile));
    setOpportunities(payload.opportunities);
    setSavedIds(new Set(payload.savedOpportunityIds));
    setCheckedDocs(toCheckedDocSets(payload.checkedDocs));
    setApplications(payload.applications ?? {});
    setAdmin(payload.admin);
    if (!payload.opportunities.some((item) => item.id === selectedId) && payload.opportunities[0]) {
      setSelectedId(payload.opportunities[0].id);
    }
  }

  async function loadBootstrap() {
    setErrorMessage("");
    const payload = await api<BootstrapPayload>("/api/bootstrap");
    applyBootstrap(payload);
  }

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api<BootstrapPayload>("/api/bootstrap")
      .then((payload) => {
        if (!ignore) {
          applyBootstrap(payload);
        }
      })
      .catch((error: Error) => {
        if (!ignore) {
          setErrorMessage(error.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const selectedOpportunity = opportunities.find((item) => item.id === selectedId) ?? opportunities[0];

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((item) => {
      const matchesCategory = category === "전체" || item.category === category;
      const haystack = `${item.title} ${item.organization} ${item.region} ${item.benefitType}`;
      const matchesQuery = haystack.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [category, opportunities, query]);

  const savedOpportunities = opportunities.filter((item) => savedIds.has(item.id));
  const actionableOpportunities = opportunities.filter((item) => item.status !== "지원불가");
  const supportOpportunities = actionableOpportunities.filter((item) => item.category !== "공모전");
  const contestOpportunities = actionableOpportunities.filter((item) => item.category === "공모전");
  const estimatedAmount = supportOpportunities.reduce((sum, item) => sum + item.amountMax, 0);
  const contestPrizePool = contestOpportunities.reduce((sum, item) => sum + item.amountMax, 0);
  const urgentCount = actionableOpportunities.filter((item) => item.dday <= 7).length;

  async function toggleSaved(id: string) {
    const saved = savedIds.has(id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (saved) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (!saved) {
      setApplications((current) => ({
        ...current,
        [id]: current[id] ?? defaultApplicationPlan()
      }));
    }

    try {
      const payload = await api<BootstrapPayload>(saved ? `/api/saved-opportunities/${id}` : "/api/saved-opportunities", {
        method: saved ? "DELETE" : "POST",
        body: saved ? undefined : JSON.stringify({ opportunityId: id })
      });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "저장 상태 변경 실패");
      await loadBootstrap();
    }
  }

  async function updateApplicationProgress(opportunityId: string, patch: Partial<ApplicationPlan>) {
    setApplications((current) => ({
      ...current,
      [opportunityId]: {
        ...(current[opportunityId] ?? defaultApplicationPlan()),
        ...patch,
        updatedAt: new Date().toISOString()
      }
    }));

    try {
      const payload = await api<BootstrapPayload>(`/api/applications/${opportunityId}/progress`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "신청 상태 저장 실패");
      await loadBootstrap();
    }
  }

  async function startApplication(opportunityId: string) {
    if (!savedIds.has(opportunityId)) {
      await toggleSaved(opportunityId);
    }
    await updateApplicationProgress(opportunityId, { status: "서류준비" });
  }

  async function toggleDocument(opportunityId: string, document: string) {
    const checked = checkedDocs[opportunityId]?.has(document) ?? false;
    setCheckedDocs((current) => {
      const next = { ...current };
      const docs = new Set(next[opportunityId] ?? []);
      if (checked) {
        docs.delete(document);
      } else {
        docs.add(document);
      }
      next[opportunityId] = docs;
      return next;
    });

    try {
      const payload = await api<BootstrapPayload>(`/api/applications/${opportunityId}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({ document, checked: !checked })
      });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "체크리스트 저장 실패");
      await loadBootstrap();
    }
  }

  async function saveProfile(nextProfile: Profile) {
    const normalizedProfile = normalizeProfileForUi(nextProfile);
    setProfile(normalizedProfile);
    try {
      const payload = await api<BootstrapPayload>("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify(normalizedProfile)
      });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "프로필 저장 실패");
    }
  }

  async function approveExtraction(id: string) {
    try {
      const payload = await api<BootstrapPayload>(`/api/admin/extractions/${id}/approve`, { method: "POST" });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "검수 승인 실패");
    }
  }

  async function rejectExtraction(id: string) {
    try {
      const payload = await api<BootstrapPayload>(`/api/admin/extractions/${id}/reject`, { method: "POST" });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "검수 반려 실패");
    }
  }

  async function createContestCandidate(draft: ManualContestDraft) {
    try {
      const payload = await api<BootstrapPayload>("/api/admin/contest-candidates", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "공모전 등록 실패");
    }
  }

  async function runSourceSync(sourceId?: string) {
    try {
      const payload = await api<BootstrapPayload>(sourceId ? `/api/admin/sources/${sourceId}/run` : "/api/admin/sources/run", { method: "POST" });
      applyBootstrap(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "수집 실행 실패");
    }
  }

  if (loading) {
    return (
      <div className="boot-screen">
        <ShieldCheck size={34} />
        <strong>오퍼가디언 MVP API 연결 중</strong>
        <span>추천 엔진과 공고 데이터를 불러오고 있습니다.</span>
      </div>
    );
  }

  if (errorMessage && opportunities.length === 0) {
    return (
      <div className="boot-screen error-screen">
        <AlertTriangle size={34} />
        <strong>API 서버에 연결할 수 없습니다</strong>
        <span>{errorMessage}</span>
        <button className="primary-button" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>오퍼가디언</strong>
            <span>Opportunity Match</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="주요 메뉴">
          <NavItem icon={<LayoutDashboard size={18} />} label="대시보드" active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} />
          <NavItem icon={<Sparkles size={18} />} label="추천 기회" active={activeView === "recommendations"} onClick={() => setActiveView("recommendations")} />
          <NavItem icon={<Star size={18} />} label="저장/준비" active={activeView === "saved"} onClick={() => setActiveView("saved")} />
          <NavItem icon={<UserRound size={18} />} label="내 프로필" active={activeView === "profile"} onClick={() => setActiveView("profile")} />
          <NavItem icon={<Database size={18} />} label="운영 검수" active={activeView === "admin"} onClick={() => setActiveView("admin")} />
        </nav>

        <div className="sidebar-status">
          <div className="status-row">
            <span>프로필 완성도</span>
            <strong>{profile.completion}%</strong>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${profile.completion}%` }} />
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="overlay" aria-label="메뉴 닫기" onClick={() => setMobileNavOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={() => setMobileNavOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <span>{profile.school} · {profile.grade}</span>
            <h1>{viewTitle(activeView)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="알림">
              <Bell size={19} />
              <span className="dot" />
            </button>
            <button className="icon-button" aria-label="설정">
              <Settings size={19} />
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="inline-alert" role="status">
            <AlertTriangle size={17} />
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage("")}>닫기</button>
          </div>
        )}

        {activeView === "dashboard" && (
          <Dashboard
            opportunities={opportunities}
            estimatedAmount={estimatedAmount}
            urgentCount={urgentCount}
            profile={profile}
            savedIds={savedIds}
            checkedDocs={checkedDocs}
            applications={applications}
            contestCount={contestOpportunities.length}
            contestPrizePool={contestPrizePool}
            onViewRecommendations={() => setActiveView("recommendations")}
            onSelectOpportunity={(id) => {
              setSelectedId(id);
              setActiveView("recommendations");
            }}
          />
        )}

        {activeView === "recommendations" && selectedOpportunity && (
          <RecommendationsView
            opportunities={filteredOpportunities}
            selectedOpportunity={selectedOpportunity}
            savedIds={savedIds}
            checkedDocs={checkedDocs}
            applications={applications}
            query={query}
            category={category}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            onSelect={setSelectedId}
            onToggleSaved={toggleSaved}
            onStartApplication={startApplication}
            onUpdateApplication={updateApplicationProgress}
          />
        )}

        {activeView === "saved" && (
          <SavedView
            opportunities={savedOpportunities}
            checkedDocs={checkedDocs}
            applications={applications}
            onToggleDocument={toggleDocument}
            onUpdateApplication={updateApplicationProgress}
            onOpenOpportunity={(id) => {
              setSelectedId(id);
              setActiveView("recommendations");
            }}
          />
        )}

        {activeView === "profile" && <ProfileView profile={profile} onProfileChange={saveProfile} onComplete={() => setActiveView("dashboard")} />}

        {activeView === "admin" && (
          <AdminView admin={admin} onApprove={approveExtraction} onReject={rejectExtraction} onRunSourceSync={runSourceSync} onCreateContestCandidate={createContestCandidate} />
        )}
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Dashboard({
  opportunities,
  estimatedAmount,
  urgentCount,
  profile,
  savedIds,
  checkedDocs,
  applications,
  contestCount,
  contestPrizePool,
  onViewRecommendations,
  onSelectOpportunity
}: {
  opportunities: Opportunity[];
  estimatedAmount: number;
  urgentCount: number;
  profile: Profile;
  savedIds: Set<string>;
  checkedDocs: Record<string, Set<string>>;
  applications: Record<string, ApplicationPlan>;
  contestCount: number;
  contestPrizePool: number;
  onViewRecommendations: () => void;
  onSelectOpportunity: (id: string) => void;
}) {
  const topMatches = opportunities.filter((item) => item.status !== "지원불가").slice(0, 3);
  const savedPlans = opportunities
    .filter((item) => savedIds.has(item.id))
    .sort((a, b) => a.dday - b.dday)
    .slice(0, 3);

  return (
    <div className="content-stack">
      <section className="metrics-grid" aria-label="요약 지표">
        <MetricCard icon={<Sparkles size={20} />} label="추천 가능 기회" value={`${opportunities.filter((item) => item.status !== "지원불가").length}개`} tone="green" />
        <MetricCard icon={<BookOpenCheck size={20} />} label="장학/지원 예상 금액" value={`${currencyFormatter.format(estimatedAmount)}원`} tone="blue" />
        <MetricCard icon={<CalendarClock size={20} />} label="7일 내 마감" value={`${urgentCount}개`} tone="red" />
        <MetricCard icon={<Star size={20} />} label="추천 공모전" value={`${contestCount}개`} tone="yellow" caption={`상금 풀 ${currencyFormatter.format(contestPrizePool)}원`} />
      </section>

      <section className="dashboard-grid">
        <div className="panel panel-wide">
          <div className="section-heading">
            <div>
              <p>오늘 우선순위</p>
              <h2>지원 가능성이 높은 기회</h2>
            </div>
            <button className="text-button" onClick={onViewRecommendations}>
              전체 보기
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="priority-list">
            {topMatches.map((item) => (
              <button className="priority-item" key={item.id} onClick={() => onSelectOpportunity(item.id)}>
                <div className="score-ring" aria-label={`매칭도 ${item.matchScore}%`}>
                  {item.matchScore}
                </div>
                <div className="priority-copy">
                  <strong>{item.title}</strong>
                  <span>{item.organization} · {item.amountText}</span>
                </div>
                <DeadlineBadge dday={item.dday} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p>내 조건</p>
              <h2>매칭 프로필</h2>
            </div>
            <UserRound size={22} />
          </div>
          <dl className="profile-summary">
            <div>
              <dt>학교</dt>
              <dd>{profile.school}</dd>
            </div>
            <div>
              <dt>지역</dt>
              <dd>{profile.residence}</dd>
            </div>
            <div>
              <dt>전공</dt>
              <dd>{profile.major}</dd>
            </div>
            <div>
              <dt>소득구간</dt>
              <dd>{profile.incomeBracket}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p>수집 커버리지</p>
              <h2>운영 상태</h2>
            </div>
            <Database size={22} />
          </div>
          <CoverageRows />
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p>이번 주 실행</p>
              <h2>신청 플랜</h2>
            </div>
            <ListChecks size={22} />
          </div>
          <div className="action-plan-list">
            {savedPlans.map((item) => {
              const checked = checkedDocs[item.id] ?? new Set<string>();
              const application = applications[item.id] ?? defaultApplicationPlan();
              return (
                <button className="action-plan-item" key={item.id} onClick={() => onSelectOpportunity(item.id)}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{nextActionLabel(item, checked, application)}</span>
                  </div>
                  <div>
                    <ApplicationStatusBadge status={application.status} />
                    <DeadlineBadge dday={item.dday} />
                  </div>
                </button>
              );
            })}
            {savedPlans.length === 0 && <p className="muted-copy">추천 기회를 저장하면 신청 플랜이 생성됩니다.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
  caption
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "blue" | "red" | "yellow";
  caption?: string;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </article>
  );
}

function RecommendationsView({
  opportunities: visibleOpportunities,
  selectedOpportunity,
  savedIds,
  checkedDocs,
  applications,
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onToggleSaved,
  onStartApplication,
  onUpdateApplication
}: {
  opportunities: Opportunity[];
  selectedOpportunity: Opportunity;
  savedIds: Set<string>;
  checkedDocs: Record<string, Set<string>>;
  applications: Record<string, ApplicationPlan>;
  query: string;
  category: Category;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: Category) => void;
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onStartApplication: (id: string) => void;
  onUpdateApplication: (id: string, patch: Partial<ApplicationPlan>) => void;
}) {
  return (
    <div className="recommendation-layout">
      <section className="list-panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="공고, 기관, 지역 검색" />
          </label>
          <div className="category-tabs" role="tablist" aria-label="카테고리 필터">
            {CATEGORY_OPTIONS.map((item) => (
              <button key={item} className={category === item ? "selected" : ""} onClick={() => onCategoryChange(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="list-heading">
          <span>
            <Filter size={16} />
            {visibleOpportunities.length}개 추천
          </span>
          <small>매칭도 높은 순</small>
        </div>

        <div className="opportunity-list">
          {visibleOpportunities.map((item) => (
            <OpportunityCard
              key={item.id}
              opportunity={item}
              selected={item.id === selectedOpportunity.id}
              saved={savedIds.has(item.id)}
              onSelect={() => onSelect(item.id)}
              onToggleSaved={() => onToggleSaved(item.id)}
            />
          ))}
        </div>
      </section>

      <OpportunityDetail
        opportunity={selectedOpportunity}
        saved={savedIds.has(selectedOpportunity.id)}
        checkedDocs={checkedDocs[selectedOpportunity.id] ?? new Set<string>()}
        application={applications[selectedOpportunity.id] ?? defaultApplicationPlan()}
        onToggleSaved={() => onToggleSaved(selectedOpportunity.id)}
        onStartApplication={() => onStartApplication(selectedOpportunity.id)}
        onUpdateApplication={(patch) => onUpdateApplication(selectedOpportunity.id, patch)}
      />
    </div>
  );
}

function OpportunityCard({
  opportunity,
  selected,
  saved,
  onSelect,
  onToggleSaved
}: {
  opportunity: Opportunity;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <article className={`opportunity-card ${selected ? "selected-card" : ""}`}>
      <button className="card-main" onClick={onSelect}>
        <div className="card-topline">
          <StatusBadge status={opportunity.status} />
          <DeadlineBadge dday={opportunity.dday} />
        </div>
        <h3>{opportunity.title}</h3>
        <p>{opportunity.organization}</p>
        <div className="card-meta">
          <span>
            <MapPin size={15} />
            {opportunity.region}
          </span>
          <span>
            <GraduationCap size={15} />
            {opportunity.schoolScope}
          </span>
        </div>
        <div className="card-bottom">
          <strong>{opportunity.amountText}</strong>
          <span>매칭 {opportunity.matchScore}%</span>
        </div>
      </button>
      <button className={`save-button ${saved ? "saved" : ""}`} aria-label={saved ? "저장 해제" : "저장"} onClick={onToggleSaved}>
        <Star size={18} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

function OpportunityDetail({
  opportunity,
  saved,
  checkedDocs,
  application,
  onToggleSaved,
  onStartApplication,
  onUpdateApplication
}: {
  opportunity: Opportunity;
  saved: boolean;
  checkedDocs: Set<string>;
  application: ApplicationPlan;
  onToggleSaved: () => void;
  onStartApplication: () => void;
  onUpdateApplication: (patch: Partial<ApplicationPlan>) => void;
}) {
  const documentProgress = Math.round((checkedDocs.size / opportunity.documents.length) * 100);
  const pendingDocuments = opportunity.documents.filter((document) => !checkedDocs.has(document));

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div>
          <StatusBadge status={opportunity.status} />
          <h2>{opportunity.title}</h2>
          <p>{opportunity.organization}</p>
        </div>
        <button className={`icon-button ${saved ? "accent" : ""}`} aria-label={saved ? "저장 해제" : "저장"} onClick={onToggleSaved}>
          <Star size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="amount-box">
        <span>지원 규모</span>
        <strong>{opportunity.amountText}</strong>
        <small>최종 선발 및 중복수혜 조건에 따라 달라질 수 있음</small>
      </div>

      <div className="detail-grid">
        <InfoTile icon={<CalendarClock size={17} />} label="마감" value={`${opportunity.deadline} · D-${opportunity.dday}`} />
        <InfoTile icon={<BookOpenCheck size={17} />} label="유형" value={opportunity.benefitType} />
        <InfoTile icon={<Building2 size={17} />} label="수집" value={opportunity.sourceType} />
        <InfoTile icon={<ShieldCheck size={17} />} label="신뢰도" value={`${Math.round(opportunity.confidence * 100)}%`} />
      </div>

      {opportunity.category === "공모전" && <ContestFitPanel opportunity={opportunity} />}

      <section className="application-panel">
        <div className="application-panel-head">
          <div>
            <span>신청 실행</span>
            <h3>{nextActionLabel(opportunity, checkedDocs, application)}</h3>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>
        <div className="progress-track" aria-label={`서류 준비율 ${documentProgress}%`}>
          <div className="progress-fill" style={{ width: `${documentProgress}%` }} />
        </div>
        <div className="status-control" aria-label="신청 상태">
          {APPLICATION_STATUSES.map((status) => (
            <button key={status} className={application.status === status ? "selected" : ""} onClick={() => onUpdateApplication({ status })}>
              {status}
            </button>
          ))}
        </div>
        <div className="application-next">
          <span>{pendingDocuments.length === 0 ? "필수 서류가 모두 체크되었습니다." : `남은 서류 ${pendingDocuments.length}개: ${pendingDocuments.slice(0, 2).join(", ")}`}</span>
          <button className={application.reminderEnabled ? "selected" : ""} onClick={() => onUpdateApplication({ reminderEnabled: !application.reminderEnabled })}>
            <Bell size={15} />
            {application.reminderEnabled ? "알림 켜짐" : "알림 켜기"}
          </button>
        </div>
      </section>

      <ReasonSection title="추천 근거" icon={<Check size={17} />} items={opportunity.reasons} tone="positive" />
      <ReasonSection title="확인 필요" icon={<Info size={17} />} items={opportunity.unknowns} tone="neutral" />
      <ReasonSection title="주의 조건" icon={<AlertTriangle size={17} />} items={opportunity.warnings} tone="warning" />

      <section className="document-strip" aria-label="필요 서류">
        <h3>필요 서류</h3>
        <div>
          {opportunity.documents.map((document) => (
            <span key={document}>{document}</span>
          ))}
        </div>
      </section>

      <div className="detail-actions">
        <button className="primary-button" onClick={onStartApplication}>
          <FileCheck2 size={18} />
          신청 준비
        </button>
        <button className="secondary-button" onClick={() => onUpdateApplication({ reminderEnabled: !application.reminderEnabled })}>
          <Bell size={18} />
          {application.reminderEnabled ? "알림 해제" : "마감 알림"}
        </button>
      </div>
    </aside>
  );
}

function SavedView({
  opportunities: savedOpportunities,
  checkedDocs,
  applications,
  onToggleDocument,
  onUpdateApplication,
  onOpenOpportunity
}: {
  opportunities: Opportunity[];
  checkedDocs: Record<string, Set<string>>;
  applications: Record<string, ApplicationPlan>;
  onToggleDocument: (opportunityId: string, document: string) => void;
  onUpdateApplication: (opportunityId: string, patch: Partial<ApplicationPlan>) => void;
  onOpenOpportunity: (id: string) => void;
}) {
  if (savedOpportunities.length === 0) {
    return (
      <div className="empty-state">
        <Star size={28} />
        <h2>저장한 공고가 없습니다</h2>
        <p>추천 기회에서 관심 있는 공고를 저장하면 서류 체크리스트가 생성됩니다.</p>
      </div>
    );
  }

  return (
    <div className="saved-grid">
      {savedOpportunities.map((item) => {
        const checked = checkedDocs[item.id] ?? new Set<string>();
        const progress = Math.round((checked.size / item.documents.length) * 100);
        const application = applications[item.id] ?? defaultApplicationPlan();
        return (
          <section className="checklist-panel" key={item.id}>
            <div className="section-heading">
              <div>
                <p>D-{item.dday} · {item.amountText}</p>
                <h2>{item.title}</h2>
              </div>
              <button className="icon-button" aria-label="공고 열기" onClick={() => onOpenOpportunity(item.id)}>
                <ChevronRight size={19} />
              </button>
            </div>
            <div className="progress-track" aria-label={`준비율 ${progress}%`}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="application-summary">
              <ApplicationStatusBadge status={application.status} />
              <span>{nextActionLabel(item, checked, application)}</span>
            </div>
            <div className="status-control compact-status" aria-label={`${item.title} 신청 상태`}>
              {APPLICATION_STATUSES.map((status) => (
                <button key={status} className={application.status === status ? "selected" : ""} onClick={() => onUpdateApplication(item.id, { status })}>
                  {status}
                </button>
              ))}
            </div>
            <ul className="checklist">
              {item.documents.map((document) => (
                <li key={document}>
                  <button className={checked.has(document) ? "checked" : ""} onClick={() => onToggleDocument(item.id, document)}>
                    {checked.has(document) ? <Check size={17} /> : <span />}
                    {document}
                  </button>
                </li>
              ))}
            </ul>
            <button className={`reminder-row ${application.reminderEnabled ? "selected" : ""}`} onClick={() => onUpdateApplication(item.id, { reminderEnabled: !application.reminderEnabled })}>
              <Bell size={16} />
              {application.reminderEnabled ? `D-${item.dday} 마감 알림 켜짐` : "마감 알림 켜기"}
            </button>
          </section>
        );
      })}
    </div>
  );
}

function ProfileView({
  profile,
  onProfileChange,
  onComplete
}: {
  profile: Profile;
  onProfileChange: (profile: Profile) => void | Promise<void>;
  onComplete: () => void;
}) {
  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    void onProfileChange({ ...profile, [key]: value, completion: Math.min(92, profile.completion + 1) });
  }

  return (
    <div className="profile-layout">
      <section className="profile-form-panel">
        <div className="section-heading">
          <div>
            <p>추천 정확도</p>
            <h2>내 프로필</h2>
          </div>
          <div className="completion-chip">{profile.completion}%</div>
        </div>

        <div className="form-grid">
          <ScrollSelectField
            label="학교"
            value={profile.school}
            options={UNIVERSITY_OPTIONS}
            placeholder="대학교 이름 검색"
            onChange={(value) => updateProfile("school", value)}
          />
          <ChoiceField
            label="재학상태"
            value={profile.status}
            options={["재학", "휴학", "졸업유예", "졸업예정", "대학원 재학"]}
            onChange={(value) => updateProfile("status", value)}
          />
          <ChoiceField
            label="학년"
            value={profile.grade}
            options={["1학년", "2학년", "3학년", "4학년"]}
            onChange={(value) => updateProfile("grade", value)}
          />
          <ScrollSelectField
            label="전공"
            value={profile.major}
            options={MAJOR_OPTIONS}
            placeholder="전공/학과명 검색"
            onChange={(value) => updateProfile("major", value)}
          />
          <RegionField
            label="현재 거주지"
            value={profile.residence}
            allowNone={false}
            onChange={(value) => updateProfile("residence", value)}
          />
          <RegionField
            label="출신지역"
            value={profile.hometown}
            allowNone
            onChange={(value) => updateProfile("hometown", value)}
          />
          <ChoiceField
            label="직전학기 성적"
            value={profile.gpa}
            options={["4.0 / 4.5 이상", "3.8 / 4.5", "3.5 / 4.5", "3.0 / 4.5", "2.5 / 4.5", "아직 모름"]}
            onChange={(value) => updateProfile("gpa", value)}
          />
          <ChoiceField
            label="소득구간"
            value={profile.incomeBracket}
            options={["기초/차상위", "1구간", "2구간", "3구간", "4~5구간", "6~8구간", "아직 모름"]}
            onChange={(value) => updateProfile("incomeBracket", value)}
          />
          <ChoiceField
            label="거주기간"
            value={profile.residenceMonths}
            options={["6개월 미만", "6개월 이상", "1년 이상", "3년 이상", "아직 모름"]}
            onChange={(value) => updateProfile("residenceMonths", value)}
          />
          <ChoiceField
            label="우선 혜택"
            value={profile.benefitPreference}
            options={["생활비/주거비 우선", "등록금 우선", "해외연수/교육", "멘토링/활동비", "금액 큰 순"]}
            onChange={(value) => updateProfile("benefitPreference", value)}
          />
          <MultiChoiceField
            label="해당/관심 조건"
            values={profile.specialConditions}
            options={["지역인재", "소득연계 관심", "다문화가정", "보훈/국가유공", "장애학생", "농어촌", "창업/IT", "멘토링 가능"]}
            onChange={(values) => updateProfile("specialConditions", values)}
          />
          <MultiChoiceField
            label="공모전 관심 분야"
            values={profile.contestInterests}
            options={CONTEST_INTEREST_OPTIONS}
            onChange={(values) => updateProfile("contestInterests", values)}
          />
          <MultiChoiceField
            label="공모전 보유 역량"
            values={profile.skills}
            options={SKILL_OPTIONS}
            onChange={(values) => updateProfile("skills", values)}
          />
          <ChoiceField
            label="팀 참여"
            value={profile.teamPreference}
            options={["개인 선호", "팀 가능", "팀 선호", "팀원 찾는 중"]}
            onChange={(value) => updateProfile("teamPreference", value)}
          />
          <ChoiceField
            label="주당 투자 가능 시간"
            value={profile.weeklyHours}
            options={["주 3시간 이하", "주 3~5시간", "주 5~10시간", "주 10시간 이상", "아직 모름"]}
            onChange={(value) => updateProfile("weeklyHours", value)}
          />
          <ChoiceField
            label="공모전 목표"
            value={profile.contestGoal}
            options={["상금", "포트폴리오", "취업/인턴", "창업 검증", "수상 경력", "경험 쌓기"]}
            onChange={(value) => updateProfile("contestGoal", value)}
          />
        </div>

        <div className="profile-actions">
          <button className="primary-button" onClick={onComplete}>
            <Sparkles size={18} />
            내 추천 확인
          </button>
          <span>선택한 조건은 바로 저장되고 추천엔진에 반영됩니다.</span>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>추가 입력</p>
            <h2>정확도 개선</h2>
          </div>
          <ListChecks size={22} />
        </div>
        <div className="improvement-list">
          <ImprovementItem label="거주기간" detail="지역 장학금 조건 판정" done />
          <ImprovementItem label="중복수혜 여부" detail="등록금성 장학금 경고" />
          <ImprovementItem label="활동 가능 시간" detail="멘토링/근로성 장학금" />
          <ImprovementItem label="우대조건" detail="선택 입력, 건너뛰기 가능" />
          <ImprovementItem label="공모전 관심 분야" detail="분야/제출물 기반 추천" done={profile.contestInterests.length > 0} />
          <ImprovementItem label="팀 참여 성향" detail="개인/팀 공모전 필터링" done={Boolean(profile.teamPreference)} />
        </div>
      </section>
    </div>
  );
}

function MultiChoiceField({
  label,
  values,
  options,
  onChange
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  const valueSet = new Set(values);

  return (
    <fieldset className="choice-field multi-choice-field">
      <legend>{label}</legend>
      <div>
        {options.map((option) => {
          const selected = valueSet.has(option);
          return (
            <button
              key={option}
              type="button"
              className={selected ? "selected" : ""}
              onClick={() => {
                const next = new Set(valueSet);
                if (selected) {
                  next.delete(option);
                } else {
                  next.add(option);
                }
                onChange([...next]);
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ScrollSelectField({
  label,
  value,
  options,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const normalizedOptions = options.includes(value) ? options : [value, ...options].filter(Boolean);
  const visibleOptions = normalizedOptions.filter((option) => option.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <fieldset className="scroll-select-field">
      <legend>{label}</legend>
      <div className="selected-value">
        <span>현재 선택</span>
        <strong>{value || "선택 필요"}</strong>
      </div>
      <label className="mini-search">
        <Search size={16} />
        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={placeholder} />
      </label>
      <div className="vertical-option-list" role="listbox" aria-label={label}>
        {visibleOptions.map((option) => (
          <button key={option} type="button" className={value === option ? "selected" : ""} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
        {visibleOptions.length === 0 && <p>검색 결과가 없습니다.</p>}
      </div>
    </fieldset>
  );
}

function RegionField({
  label,
  value,
  allowNone,
  onChange
}: {
  label: string;
  value: string;
  allowNone: boolean;
  onChange: (value: string) => void;
}) {
  const provinceOptions = Object.keys(REGION_GROUPS).sort((a, b) => a.localeCompare(b, "ko"));
  const initialProvince = getProvinceFromRegion(value, provinceOptions) ?? provinceOptions[0];
  const [selectedProvince, setSelectedProvince] = useState(initialProvince);
  const cities = REGION_GROUPS[selectedProvince] ?? [];

  function selectProvince(province: string) {
    setSelectedProvince(province);
    const firstCity = REGION_GROUPS[province]?.[0];
    if (firstCity) {
      onChange(formatRegion(province, firstCity));
    }
  }

  return (
    <fieldset className="region-field">
      <legend>{label}</legend>
      <div className="selected-value">
        <span>현재 선택</span>
        <strong>{value || "선택 필요"}</strong>
      </div>
      <div className="region-picker">
        <div className="region-column">
          <span>시·도</span>
          <div className="vertical-option-list compact-list">
            {allowNone && (
              <button type="button" className={value === "해당 없음" ? "selected" : ""} onClick={() => onChange("해당 없음")}>
                해당 없음
              </button>
            )}
            {provinceOptions.map((province) => (
              <button key={province} type="button" className={selectedProvince === province && value !== "해당 없음" ? "selected" : ""} onClick={() => selectProvince(province)}>
                {province}
              </button>
            ))}
          </div>
        </div>
        <div className="region-column">
          <span>시·군·구</span>
          <div className="vertical-option-list compact-list">
            {cities.map((city) => {
              const region = formatRegion(selectedProvince, city);
              return (
                <button key={city} type="button" className={value === region ? "selected" : ""} onClick={() => onChange(region)}>
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const normalizedOptions = options.includes(value) ? options : [value, ...options];

  return (
    <fieldset className="choice-field">
      <legend>{label}</legend>
      <div>
        {normalizedOptions.map((option) => (
          <button key={option} type="button" className={value === option ? "selected" : ""} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AdminView({
  admin,
  onApprove,
  onReject,
  onRunSourceSync,
  onCreateContestCandidate
}: {
  admin: AdminData;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRunSourceSync: (sourceId?: string) => Promise<void>;
  onCreateContestCandidate: (draft: ManualContestDraft) => Promise<void>;
}) {
  const [contestDraft, setContestDraft] = useState<ManualContestDraft>({
    title: "",
    organization: "",
    url: ""
  });
  const canSubmitContest = contestDraft.title.trim().length >= 4;

  async function submitContestDraft() {
    if (!canSubmitContest) {
      return;
    }
    await onCreateContestCandidate(contestDraft);
    setContestDraft({ title: "", organization: "", url: "" });
  }

  return (
    <div className="admin-layout">
      <section className="metrics-grid">
        <MetricCard icon={<Database size={20} />} label="오늘 수집" value={`${admin.todayCollected}건`} tone="blue" />
        <MetricCard icon={<ClipboardCheck size={20} />} label="검수 대기" value={`${admin.pendingReview}건`} tone="yellow" />
        <MetricCard icon={<AlertTriangle size={20} />} label="추출 실패" value={`${admin.extractionFailures}건`} tone="red" />
        <MetricCard icon={<ShieldCheck size={20} />} label="자동 승인률" value={`${admin.autoApprovalRate}%`} tone="green" />
      </section>

      <section className="review-panel">
        <div className="section-heading">
          <div>
            <p>수집 파이프라인</p>
            <h2>실제 데이터 소스</h2>
          </div>
          <button className="primary-button" onClick={() => void onRunSourceSync()}>
            <Database size={18} />
            전체 수집
          </button>
        </div>
        <div className="source-grid">
          {admin.sources.map((source) => (
            <article className="source-card" key={source.id}>
              <div className="source-card-head">
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.organization} · {sourceTypeLabel(source.type)}</span>
                </div>
                <SourceStatusBadge status={source.status} />
              </div>
              <p>{source.notes}</p>
              <div className="source-meter">
                <div>
                  <span>커버리지</span>
                  <strong>{source.coverage}%</strong>
                </div>
                <div className="mini-track" aria-hidden="true">
                  <div style={{ width: `${source.coverage}%` }} />
                </div>
              </div>
              <div className="source-footer">
                <span>{source.lastRunAt ? new Date(source.lastRunAt).toLocaleString("ko-KR") : "아직 실행 전"}</span>
                <button className="secondary-button compact" onClick={() => void onRunSourceSync(source.id)}>
                  수집
                </button>
              </div>
              <small>{source.lastResult}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="review-panel">
        <div className="section-heading">
          <div>
            <p>공모전 등록</p>
            <h2>공식 URL 검수 큐</h2>
          </div>
          <Sparkles size={22} />
        </div>
        <form
          className="manual-contest-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitContestDraft();
          }}
        >
          <TextField label="공모전명" value={contestDraft.title} onChange={(value) => setContestDraft((current) => ({ ...current, title: value }))} />
          <TextField label="주최/기관" value={contestDraft.organization} onChange={(value) => setContestDraft((current) => ({ ...current, organization: value }))} />
          <TextField label="공식 원문 URL" value={contestDraft.url} onChange={(value) => setContestDraft((current) => ({ ...current, url: value }))} />
          <button className="primary-button" type="submit" disabled={!canSubmitContest}>
            <ClipboardCheck size={18} />
            검수 큐 등록
          </button>
        </form>
      </section>

      <section className="review-panel">
        <div className="section-heading">
          <div>
            <p>크롤러 로그</p>
            <h2>최근 수집 실행</h2>
          </div>
          <CalendarClock size={22} />
        </div>
        <div className="crawl-run-list">
          {admin.crawlRuns.map((run) => (
            <div className="crawl-run-item" key={run.id}>
              <div>
                <strong>{run.sourceName}</strong>
                <span>{run.message}</span>
              </div>
              <div>
                <SourceStatusBadge status={run.status === "SUCCESS" ? "ACTIVE" : run.status === "RUNNING" ? "PAUSED" : "BROKEN"} />
                <span>{run.foundCount}개 발견 · {run.newCount}개 신규</span>
              </div>
            </div>
          ))}
          {admin.crawlRuns.length === 0 && <p className="muted-copy">아직 실행된 수집 작업이 없습니다.</p>}
        </div>
      </section>

      <section className="review-panel">
        <div className="section-heading">
          <div>
            <p>AI 추출 검수</p>
            <h2>확인 필요한 공고</h2>
          </div>
          <button className="secondary-button" onClick={() => void onRunSourceSync()}>
            <Database size={18} />
            수집 실행
          </button>
        </div>
        <div className="review-list">
          {admin.extractionQueue.map((item) => (
            <article className="review-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.organization} · {item.source}</span>
              </div>
              <div className="review-meta">
                <span>신뢰도 {Math.round(item.confidence * 100)}%</span>
                <span>{item.missing}</span>
              </div>
              <div className="review-actions">
                <button className="secondary-button compact" onClick={() => void onReject(item.id)}>
                  <X size={16} />
                  반려
                </button>
                <button className="primary-button compact" onClick={() => void onApprove(item.id)}>
                  <Check size={16} />
                  승인
                </button>
              </div>
            </article>
          ))}
          {admin.extractionQueue.length === 0 && (
            <div className="empty-state compact-empty">
              <ClipboardCheck size={24} />
              <h2>검수 대기 공고가 없습니다</h2>
              <p>새 수집 작업을 실행하거나 외부 소스를 추가하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </section>

      <section className="review-panel">
        <div className="section-heading">
          <div>
            <p>감사로그</p>
            <h2>최근 운영 이벤트</h2>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="audit-list">
          {admin.auditLogs.map((log) => (
            <div className="audit-item" key={log.id}>
              <strong>{actionLabel(log.action)}</strong>
              <span>{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
            </div>
          ))}
          {admin.auditLogs.length === 0 && <p className="muted-copy">아직 기록된 이벤트가 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}

function SourceStatusBadge({ status }: { status: SourceItem["status"] }) {
  const labels: Record<SourceItem["status"], string> = {
    ACTIVE: "활성",
    NEEDS_KEY: "키 필요",
    BROKEN: "오류",
    PAUSED: "대기"
  };
  return <span className={`source-status source-${status}`}>{labels[status]}</span>;
}

function sourceTypeLabel(type: SourceItem["type"]) {
  const labels: Record<SourceItem["type"], string> = {
    API: "공식 API",
    HTML: "공개 HTML",
    MANUAL: "수동 검수"
  };
  return labels[type];
}

function ReasonSection({
  title,
  icon,
  items,
  tone
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "positive" | "neutral" | "warning";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={`reason-section ${tone}`}>
      <h3>
        {icon}
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="info-tile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ContestFitPanel({ opportunity }: { opportunity: Opportunity }) {
  const rows = [
    { label: "분야", value: opportunity.contestFields?.join(", ") || "기관 확인" },
    { label: "제출물", value: opportunity.submissionTypes?.join(", ") || "공고 확인" },
    { label: "참여 방식", value: opportunity.teamMode || "공고 확인" },
    { label: "난이도", value: opportunity.difficulty || "중간" },
    { label: "포트폴리오", value: opportunity.portfolioValue || "중간" },
    { label: "시상/혜택", value: opportunity.prizeText || opportunity.amountText }
  ];

  return (
    <section className="contest-fit-panel">
      <h3>
        <Sparkles size={17} />
        공모전 적합도
      </h3>
      <div>
        {rows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ImprovementItem({ label, detail, done = false }: { label: string; detail: string; done?: boolean }) {
  return (
    <div className="improvement-item">
      <div className={done ? "done-check done" : "done-check"}>{done && <Check size={15} />}</div>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function CoverageRows() {
  const rows = [
    { label: "대학 장학공지", value: 68 },
    { label: "지자체 장학재단", value: 54 },
    { label: "민간재단 PDF", value: 39 },
    { label: "청년정책 API", value: 82 },
    { label: "공모전 공식/수동 검수", value: 35 }
  ];

  return (
    <div className="coverage-rows">
      {rows.map((row) => (
        <div className="coverage-row" key={row.label}>
          <div>
            <span>{row.label}</span>
            <strong>{row.value}%</strong>
          </div>
          <div className="mini-track" aria-hidden="true">
            <div style={{ width: `${row.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`application-status status-${status}`}>{status}</span>;
}

function DeadlineBadge({ dday }: { dday: number }) {
  const urgent = dday <= 7;
  return <span className={`deadline-badge ${urgent ? "urgent" : ""}`}>D-{dday}</span>;
}

function nextActionLabel(opportunity: Opportunity, checkedDocs: Set<string>, application: ApplicationPlan) {
  if (application.status === "제출완료") {
    return "제출 완료 기록됨";
  }
  const missingDocs = opportunity.documents.filter((document) => !checkedDocs.has(document));
  if (missingDocs.length > 0) {
    return `${missingDocs[0]} 준비`;
  }
  if (application.status === "작성중") {
    return opportunity.category === "공모전" ? "제출물 최종 점검" : "신청서 최종 검토";
  }
  if (opportunity.dday <= 3) {
    return "마감 임박, 오늘 제출 권장";
  }
  return opportunity.category === "공모전" ? "제출물 구성 시작" : "신청서 작성 시작";
}

function viewTitle(view: ViewKey) {
  const titles: Record<ViewKey, string> = {
    dashboard: "매칭 대시보드",
    recommendations: "추천 기회",
    saved: "저장/신청 준비",
    profile: "내 프로필",
    admin: "운영 검수"
  };
  return titles[view];
}

function getProvinceFromRegion(region: string, provinces: string[]) {
  if (!region || region === "해당 없음") {
    return null;
  }
  return provinces.find((province) => region.startsWith(province)) ?? null;
}

function formatRegion(province: string, city: string) {
  if (province === "세종특별자치시" && city === "세종특별자치시") {
    return province;
  }
  return `${province} ${city}`;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    PROFILE_UPDATED: "프로필 저장",
    RECOMMENDATIONS_RECALCULATED: "추천 재계산",
    OPPORTUNITY_SAVED: "공고 저장",
    OPPORTUNITY_UNSAVED: "공고 저장 해제",
    APPLICATION_PROGRESS_UPDATED: "신청 상태 업데이트",
    CHECKLIST_UPDATED: "체크리스트 업데이트",
    EXTRACTION_APPROVED: "AI 추출 승인",
    EXTRACTION_REJECTED: "AI 추출 반려",
    CONTEST_CANDIDATE_CREATED: "공모전 후보 등록",
    SOURCE_RUN_COMPLETED: "수집 실행"
  };
  return labels[action] ?? action;
}

export default App;
