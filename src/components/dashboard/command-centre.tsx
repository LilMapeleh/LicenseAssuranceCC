"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefingBanner } from "@/components/dashboard/briefing-banner";
import { CaseDrawer } from "@/components/dashboard/case-drawer";
import { CasePipeline } from "@/components/dashboard/case-pipeline";
import { CloseRunway } from "@/components/dashboard/close-runway";
import { HeaderBar } from "@/components/dashboard/header-bar";
import { MondayDrafts } from "@/components/dashboard/monday-drafts";
import { MovementPanel } from "@/components/dashboard/movement-panel";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import {
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
import { authClient } from "@/lib/auth-client";
import type { Audience, CaseItem, PipelineTab, RawCase, ResolutionMetrics, TrendPoint } from "@/lib/types";

export function CommandCentre({ userName, userEmail }: { userName: string; userEmail: string }) {
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

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      setCases(await fetchCases());
    } catch (error) {
      console.error("Failed to fetch cases", error);
      setLoadError("Could not reach the case service. Use Refresh now to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const [trend, resolution] = await Promise.all([fetchTrend(metricsTimeframe), fetchResolution()]);
      setTrendData(trend);
      setResolutionMetrics(resolution);
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    }
  }, [metricsTimeframe]);

  useEffect(() => {
    void loadCases();
    void loadAnalytics();
  }, [loadCases, loadAnalytics]);

  useEffect(() => {
    const source = new EventSource("/api/dashboard/stream");
    source.onopen = () => setWsConnected(true);
    source.onmessage = (event) => {
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
          setCases((current) => current.map((item) => (item.id === message.id ? applyDetailUpdate(item, message.data!) : item)));
        }
      } catch (error) {
        console.error("Failed to parse dashboard event", error);
      }
    };
    source.onerror = () => setWsConnected(false);
    return () => source.close();
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
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/");
        },
      },
    });
  };

  const handleOpenCase = async (item: CaseItem) => {
    setSelectedCase(item);
    if (!item.oppID) return;
    try {
      const salesforce = await refreshSalesforce(item.id);
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
      await updateCaseStage(caseId, stage);
    } catch (error) {
      console.error("Failed to update stage", error);
    }
  };

  const handleSaveCase = async () => {
    if (!selectedCase) return;
    setIsSaving(true);
    try {
      await updateCaseDetails(selectedCase.id, {
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
      await updateCaseDetails(id, { close_confidence: closeConfidence });
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

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-6 py-7 text-slate-950 sm:px-10 lg:px-12">
      <HeaderBar
        dateLabel={getFormattedDate()}
        openCases={cases.length}
        quarterDays={getDaysUntilQuarterEnd()}
        connected={wsConnected}
        userName={userName}
        userEmail={userEmail}
        onSignOut={() => void handleLogout()}
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
    email_history: Array.isArray(data.email_history) ? (data.email_history as CaseItem["email_history"]) : item.email_history,
  };
}

function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

