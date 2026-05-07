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
type Category = "전체" | "장학금" | "생활비" | "주거비" | "교육/연수";

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
  type: "API" | "HTML";
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
  completion: number;
};

const initialProfile: Profile = {
  school: "한국대학교",
  status: "재학",
  grade: "3학년 1학기",
  major: "컴퓨터공학과",
  residence: "서울특별시 마포구",
  hometown: "충청남도 천안시",
  gpa: "3.8 / 4.5",
  incomeBracket: "3구간",
  residenceMonths: "6개월 이상",
  benefitPreference: "생활비/주거비 우선",
  specialConditions: ["지역인재", "소득연계 관심"],
  completion: 78
};

const currencyFormatter = new Intl.NumberFormat("ko-KR");

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

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("전체");
  const [selectedId, setSelectedId] = useState("opp-001");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [checkedDocs, setCheckedDocs] = useState<Record<string, Set<string>>>({});
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [admin, setAdmin] = useState<AdminData>(emptyAdmin);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  function applyBootstrap(payload: BootstrapPayload) {
    setProfile(payload.profile);
    setOpportunities(payload.opportunities);
    setSavedIds(new Set(payload.savedOpportunityIds));
    setCheckedDocs(toCheckedDocSets(payload.checkedDocs));
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
  const estimatedAmount = actionableOpportunities.reduce((sum, item) => sum + item.amountMax, 0);
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
    setProfile(nextProfile);
    try {
      const payload = await api<BootstrapPayload>("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify(nextProfile)
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
            savedCount={savedOpportunities.length}
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
            query={query}
            category={category}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            onSelect={setSelectedId}
            onToggleSaved={toggleSaved}
          />
        )}

        {activeView === "saved" && (
          <SavedView
            opportunities={savedOpportunities}
            checkedDocs={checkedDocs}
            onToggleDocument={toggleDocument}
            onOpenOpportunity={(id) => {
              setSelectedId(id);
              setActiveView("recommendations");
            }}
          />
        )}

        {activeView === "profile" && <ProfileView profile={profile} onProfileChange={saveProfile} />}

        {activeView === "admin" && (
          <AdminView admin={admin} onApprove={approveExtraction} onReject={rejectExtraction} onRunSourceSync={runSourceSync} />
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
  savedCount,
  onViewRecommendations,
  onSelectOpportunity
}: {
  opportunities: Opportunity[];
  estimatedAmount: number;
  urgentCount: number;
  profile: Profile;
  savedCount: number;
  onViewRecommendations: () => void;
  onSelectOpportunity: (id: string) => void;
}) {
  const topMatches = opportunities.filter((item) => item.status !== "지원불가").slice(0, 3);

  return (
    <div className="content-stack">
      <section className="metrics-grid" aria-label="요약 지표">
        <MetricCard icon={<Sparkles size={20} />} label="추천 가능 기회" value={`${opportunities.filter((item) => item.status !== "지원불가").length}개`} tone="green" />
        <MetricCard icon={<BookOpenCheck size={20} />} label="예상 지원 가능 금액" value={`${currencyFormatter.format(estimatedAmount)}원`} tone="blue" />
        <MetricCard icon={<CalendarClock size={20} />} label="7일 내 마감" value={`${urgentCount}개`} tone="red" />
        <MetricCard icon={<Star size={20} />} label="저장한 공고" value={`${savedCount}개`} tone="yellow" />
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
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "blue" | "red" | "yellow";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RecommendationsView({
  opportunities: visibleOpportunities,
  selectedOpportunity,
  savedIds,
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onToggleSaved
}: {
  opportunities: Opportunity[];
  selectedOpportunity: Opportunity;
  savedIds: Set<string>;
  query: string;
  category: Category;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: Category) => void;
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
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
            {(["전체", "장학금", "생활비", "주거비", "교육/연수"] as Category[]).map((item) => (
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

      <OpportunityDetail opportunity={selectedOpportunity} saved={savedIds.has(selectedOpportunity.id)} onToggleSaved={() => onToggleSaved(selectedOpportunity.id)} />
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
  onToggleSaved
}: {
  opportunity: Opportunity;
  saved: boolean;
  onToggleSaved: () => void;
}) {
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
        <button className="primary-button">
          <FileCheck2 size={18} />
          신청 준비
        </button>
        <button className="secondary-button">
          <Bell size={18} />
          마감 알림
        </button>
      </div>
    </aside>
  );
}

function SavedView({
  opportunities: savedOpportunities,
  checkedDocs,
  onToggleDocument,
  onOpenOpportunity
}: {
  opportunities: Opportunity[];
  checkedDocs: Record<string, Set<string>>;
  onToggleDocument: (opportunityId: string, document: string) => void;
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
          </section>
        );
      })}
    </div>
  );
}

function ProfileView({
  profile,
  onProfileChange
}: {
  profile: Profile;
  onProfileChange: (profile: Profile) => void | Promise<void>;
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
          <ChoiceField
            label="학교"
            value={profile.school}
            options={["한국대학교", "서울시립대학교", "부산대학교", "충남대학교", "강원대학교"]}
            onChange={(value) => updateProfile("school", value)}
          />
          <ChoiceField
            label="재학상태"
            value={profile.status}
            options={["재학", "휴학", "졸업유예", "졸업예정", "대학원 재학"]}
            onChange={(value) => updateProfile("status", value)}
          />
          <ChoiceField
            label="학년/학기"
            value={profile.grade}
            options={["1학년 1학기", "1학년 2학기", "2학년", "3학년 1학기", "3학년 2학기", "4학년 이상"]}
            onChange={(value) => updateProfile("grade", value)}
          />
          <ChoiceField
            label="전공"
            value={profile.major}
            options={["컴퓨터공학과", "경영학과", "간호학과", "사회복지학과", "디자인학과", "전공무관"]}
            onChange={(value) => updateProfile("major", value)}
          />
          <ChoiceField
            label="현재 거주지"
            value={profile.residence}
            options={["서울특별시 마포구", "서울특별시 은평구", "충청남도 천안시", "충청남도 아산시", "부산광역시 해운대구"]}
            onChange={(value) => updateProfile("residence", value)}
          />
          <ChoiceField
            label="출신지역"
            value={profile.hometown}
            options={["서울특별시", "충청남도 천안시", "충청남도 아산시", "전라남도", "강원특별자치도", "해당 없음"]}
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
  onRunSourceSync
}: {
  admin: AdminData;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRunSourceSync: (sourceId?: string) => Promise<void>;
}) {
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
                  <span>{source.organization} · {source.type}</span>
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
    { label: "청년정책 API", value: 82 }
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

function DeadlineBadge({ dday }: { dday: number }) {
  const urgent = dday <= 7;
  return <span className={`deadline-badge ${urgent ? "urgent" : ""}`}>D-{dday}</span>;
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

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    PROFILE_UPDATED: "프로필 저장",
    RECOMMENDATIONS_RECALCULATED: "추천 재계산",
    OPPORTUNITY_SAVED: "공고 저장",
    OPPORTUNITY_UNSAVED: "공고 저장 해제",
    CHECKLIST_UPDATED: "체크리스트 업데이트",
    EXTRACTION_APPROVED: "AI 추출 승인",
    EXTRACTION_REJECTED: "AI 추출 반려",
    SOURCE_RUN_SIMULATED: "수집 실행"
  };
  return labels[action] ?? action;
}

export default App;
