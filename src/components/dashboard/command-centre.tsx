"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MsalProvider, useMsal } from "@azure/msal-react";
import type { PublicClientApplication } from "@azure/msal-browser";
import { BriefingBanner } from "@/components/dashboard/briefing-banner";
import { CaseDrawer } from "@/components/dashboard/case-drawer";
import { CasePipeline } from "@/components/dashboard/case-pipeline";
import { CloseRunway } from "@/components/dashboard/close-runway";
import { HeaderBar } from "@/components/dashboard/header-bar";
import { MondayDrafts } from "@/components/dashboard/monday-drafts";
import { MovementPanel } from "@/components/dashboard/movement-panel";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import {
  dashboardWebSocketUrl,
  fetchCases,
  fetchResolution,
  fetchTrend,
  refreshSalesforce,
  updateCaseDetails,
  updateCaseStage,
} from "@/lib/api";
import {
  checkIsOverdue,
  getDaysUntilQuarterEnd,
  getFormattedDate,
  getMovementData,
  getNextResponsibility,
  isMovedOn,
  mapCase,
} from "@/lib/case-utils";
import { ensureMsal, loginRequest } from "@/lib/msal";
import type { Audience, CaseItem, PipelineTab, RawCase, ResolutionMetrics, TrendPoint } from "@/lib/types";

export function CommandCentre() {
  const [instance, setInstance] = useState<PublicClientApplication | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMsal()
      .then((pca) => {
        if (!cancelled) setInstance(pca);
      })
      .catch((error: unknown) => {
        console.error("Microsoft sign-in failed to start", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!instance) return <DashboardScreen msal={null} />;

  return (
    <MsalProvider instance={instance}>
      <AuthenticatedDashboard />
    </MsalProvider>
  );
}

function AuthenticatedDashboard() {
  const msal = useMsal();
  return <DashboardScreen msal={msal} />;
}

function DashboardScreen({ msal }: { msal: ReturnType<typeof useMsal> | null }) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<PipelineTab>("All open");
  const [selectedAudience, setSelectedAudience] = useState<Audience>("EMEA");
  const [draftOutput, setDraftOutput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [draggedCaseId, setDraggedCaseId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lookbackDays, setLookbackDays] = useState(1);
  const [metricsTimeframe, setMetricsTimeframe] = useState("Last 30 days");
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [resolutionMetrics, setResolutionMetrics] = useState<ResolutionMetrics>({
    avg_days: 0,
    change_pct: 0,
    timeframe: "vs. previous 30 days",
  });

  const getAccessToken = useCallback(async () => {
    if (!msal || msal.accounts.length === 0) return null;
    try {
      const response = await msal.instance.acquireTokenSilent({ ...loginRequest, account: msal.accounts[0] });
      return response.accessToken;
    } catch (error) {
      console.error("Token acquisition failed", error);
      return null;
    }
  }, [msal]);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const health = await fetch("/api/ingestion", { cache: "no-store" });
      const status = (await health.json()) as { state?: string };
      if (status.state === "stopped") {
        setCases([]);
        setLoadError("Ingestion is offline because the LACC-BE Azure app is stopped. Start that app in the Azure portal, then refresh.");
        return;
      }
      const token = await getAccessToken();
      setCases(await fetchCases(token));
    } catch (error) {
      console.error("Failed to fetch cases", error);
      setLoadError("Could not reach the case service. Use Refresh now to try again.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const loadAnalytics = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const [trend, resolution] = await Promise.all([fetchTrend(token, metricsTimeframe), fetchResolution(token)]);
      setTrendData(trend);
      setResolutionMetrics(resolution);
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    }
  }, [getAccessToken, metricsTimeframe]);

  useEffect(() => {
    void loadCases();
    void loadAnalytics();
  }, [loadCases, loadAnalytics]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let stopped = false;
    let timer = 0;

    const connect = () => {
      socket = new WebSocket(dashboardWebSocketUrl());
      socket.onopen = () => setWsConnected(true);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            event?: string;
            id?: string;
            stage?: string;
            data?: RawCase & Record<string, unknown>;
          };
          if (message.event === "DATABASE_RESET") {
            setCases([]);
            return;
          }
          if (message.event === "STAGE_UPDATE" && message.id && message.stage) {
            setCases((current) => current.map((item) => (item.id === message.id ? { ...item, stage: message.stage! } : item)));
            return;
          }
          if (message.event === "NEW_CASE_ENTRY" && message.data) {
            const mapped = mapCase(message.data);
            setCases((current) => mergeCase(current, mapped));
            return;
          }
          if (message.event === "CASE_DETAILS_UPDATE" && message.id && message.data) {
            setCases((current) =>
              current.map((item) => (item.id === message.id ? applyDetailUpdate(item, message.data!) : item)),
            );
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message", error);
        }
      };
      socket.onclose = () => {
        setWsConnected(false);
        if (!stopped) timer = window.setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, []);

  const movementGroups = useMemo(() => getMovementData(cases, lookbackDays), [cases, lookbackDays]);
  const movedOnCount = cases.filter(isMovedOn).length;
  const overdueCount = cases.filter(checkIsOverdue).length;
  const confidenceSetCount = cases.filter((item) => item.closeConfidence && item.closeConfidence !== "Not set").length;
  const totalCasesCount = cases.length || 1;
  const resolvedCount = cases.filter((item) => item.stage === "Contract to Close").length;
  const atRiskCount = cases.filter((item) => item.closeConfidence === "At risk").length;
  const onTrackCount = Math.max(0, totalCasesCount - resolvedCount - overdueCount - atRiskCount);

  const filteredCases = cases.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    const matches =
      item.customerName.toLowerCase().includes(query) ||
      (item.category || "").toLowerCase().includes(query) ||
      (item.owner || "").toLowerCase().includes(query);
    if (!matches) return false;
    if (activeTab === "Action on me") return getNextResponsibility(item) === "Andrew";
    if (activeTab === "Needs me today") return checkIsOverdue(item) && getNextResponsibility(item) === "Andrew";
    if (activeTab === "Moved on") return isMovedOn(item);
    return true;
  });

  const handleLogout = async () => {
    if (!msal) return;
    try {
      await msal.instance.logoutPopup();
    } catch (error) {
      console.error("MSAL logout error", error);
    }
  };

  const handleOpenCase = async (item: CaseItem) => {
    setSelectedCase(item);
    if (!item.oppID) return;
    try {
      const token = await getAccessToken();
      const salesforce = await refreshSalesforce(token, item.id);
      if (!salesforce) return;
      setSelectedCase((current) => (current ? { ...current, salesforce_data: salesforce } : current));
      setCases((current) => current.map((entry) => (entry.id === item.id ? { ...entry, salesforce_data: salesforce } : entry)));
    } catch (error) {
      console.error("Failed to refresh Salesforce data", error);
    }
  };

  const handleDropStage = async (stage: string, caseId: string) => {
    setDraggedCaseId(null);
    setCases((current) => current.map((item) => (item.id === caseId ? { ...item, stage } : item)));
    try {
      const token = await getAccessToken();
      await updateCaseStage(token, caseId, stage);
    } catch (error) {
      console.error("Failed to update stage", error);
    }
  };

  const handleSaveCase = async () => {
    if (!selectedCase) return;
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      await updateCaseDetails(token, selectedCase.id, {
        status: selectedCase.status,
        next_step: selectedCase.nextStep,
        approach: selectedCase.approach,
        evidence: selectedCase.evidenceSummary,
        close_confidence: selectedCase.closeConfidence,
        is_action_on_me: selectedCase.isActionOnMe,
      });
      setCases((current) => current.map((item) => (item.id === selectedCase.id ? selectedCase : item)));
      setSelectedCase(null);
    } catch (error) {
      console.error("Failed to update case details", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfidence = async (id: string, closeConfidence: string) => {
    setCases((current) => current.map((item) => (item.id === id ? { ...item, closeConfidence } : item)));
    try {
      const token = await getAccessToken();
      await updateCaseDetails(token, id, { close_confidence: closeConfidence });
    } catch (error) {
      console.error("Failed to save close confidence", error);
    }
  };

  const handleBuildDraft = () => {
    if (!selectedCaseId) {
      setDraftOutput("Please tick a case box above to generate its email draft.");
      return;
    }
    const target = cases.find((item) => item.id === selectedCaseId);
    if (!target) return;
    setDraftOutput(
      `--- MONDAY FORECAST DRAFT (${selectedAudience}) ---\n\n${target.customerName} [${target.stage}] | Status: ${target.status || target.approach} | Next step: ${target.nextStep}\n`,
    );
  };

  const account = msal?.accounts[0];

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-6 py-7 text-slate-950 sm:px-10 lg:px-12">
      <HeaderBar
        dateLabel={getFormattedDate()}
        openCases={cases.length}
        quarterDays={getDaysUntilQuarterEnd()}
        connected={wsConnected}
        userName={account?.name}
        userEmail={account?.username}
        onSignOut={account ? handleLogout : undefined}
      />

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{loadError}</div>
      )}

      <BriefingBanner cases={cases} />
      <PerformanceMetrics
        timeframe={metricsTimeframe}
        onTimeframeChange={setMetricsTimeframe}
        trend={trendData}
        resolution={resolutionMetrics}
        caseCount={cases.length}
        resolvedCount={resolvedCount}
        onTrackCount={onTrackCount}
        atRiskCount={atRiskCount}
        overdueCount={overdueCount}
      />
      <CloseRunway cases={cases} movedOn={movedOnCount} overdue={overdueCount} confidenceSet={confidenceSetCount} />
      <MovementPanel
        groups={movementGroups}
        lookbackDays={lookbackDays}
        onLookbackChange={setLookbackDays}
        refreshing={loading}
        onRefresh={() => {
          void loadCases();
          void loadAnalytics();
        }}
      />
      <CasePipeline
        cases={filteredCases}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCaseId={selectedCaseId}
        onToggleDraft={(id) => setSelectedCaseId((current) => (current === id ? null : id))}
        onOpenCase={(item) => void handleOpenCase(item)}
        onConfidenceChange={(id, value) => void handleConfidence(id, value)}
        draggedCaseId={draggedCaseId}
        onDragStart={setDraggedCaseId}
        onDropStage={(stage, caseId) => void handleDropStage(stage, caseId)}
      />
      <MondayDrafts
        audience={selectedAudience}
        onAudienceChange={setSelectedAudience}
        draft={draftOutput}
        onBuild={handleBuildDraft}
        onCopy={() => void navigator.clipboard.writeText(draftOutput)}
      />

      {selectedCase && (
        <CaseDrawer
          item={selectedCase}
          saving={isSaving}
          onChange={setSelectedCase}
          onClose={() => setSelectedCase(null)}
          onSave={() => void handleSaveCase()}
        />
      )}
    </div>
  );
}

function mergeCase(current: CaseItem[], incoming: CaseItem): CaseItem[] {
  const account = incoming.customerName.trim().toLowerCase();
  const index = current.findIndex((item) => item.id === incoming.id || item.customerName.trim().toLowerCase() === account);
  if (index === -1) return [incoming, ...current];
  const next = [...current];
  next[index] = { ...next[index], ...incoming, id: next[index].id };
  return next;
}

function applyDetailUpdate(item: CaseItem, data: RawCase & Record<string, unknown>): CaseItem {
  return {
    ...item,
    status: readString(data, "status") ?? item.status,
    nextStep: readString(data, "nextStep") ?? item.nextStep,
    approach: readString(data, "approach") ?? item.approach,
    stage: readString(data, "stage") ?? item.stage,
    closeConfidence: readString(data, "closeConfidence") ?? item.closeConfidence,
    isActionOnMe: typeof data.isActionOnMe === "boolean" ? data.isActionOnMe : item.isActionOnMe,
    dealValue: readString(data, "dealValue") ?? item.dealValue,
    dueDateText: readString(data, "dueDateText") ?? item.dueDateText,
    category: readString(data, "category") ?? item.category,
    daysOffset: typeof data.daysOffset === "number" ? data.daysOffset : item.daysOffset,
    evidenceSummary: readString(data, "evidenceSummary") ?? item.evidenceSummary,
    owner: readString(data, "owner") ?? item.owner,
    oppID: readString(data, "oppID") ?? item.oppID,
    salesforce_data: (data.salesforce_data as CaseItem["salesforce_data"]) ?? item.salesforce_data,
  };
}

function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

