import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Database, Download, Loader2, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TablePayload = {
  domain: "finance" | "procurement";
  slicer?: {
    available_years?: number[];
    selected_year?: number;
  };
  warnings?: Array<{
    entity: string;
    message: string;
  }>;
  source_metadata?: Record<string, { filter?: string; error?: { message?: string } | null }>;
  tables: Array<{
    key: string;
    label: string;
    total_rows: number;
    columns: string[];
    summary?: {
      source_row_count?: number;
      displayed_row_count?: number;
      column_count?: number;
      numeric_totals?: Array<{
        column: string;
        total: number;
        populated_rows: number;
      }>;
    };
    rows: Record<string, unknown>[];
  }>;
};

const DEFAULT_LIMIT = "50";
const DOMAIN_OPTIONS = [
  { value: "finance", label: "Finance" },
  { value: "procurement", label: "Procurement" },
];
const LIMIT_OPTIONS = ["25", "50", "100", "200"];

const normalizeApiBase = () => {
  const rawApiUrl = import.meta.env.VITE_API_URL;
  if (!rawApiUrl || /https?:\/\/(127\.0\.0\.1|localhost):5000\/api\/?$/i.test(rawApiUrl)) {
    return "/api";
  }

  return rawApiUrl.replace(/\/$/, "");
};

const API_BASE = normalizeApiBase();

const stringifyCell = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatSummaryNumber = (value: number) => numberFormatter.format(value);

const toWorksheetName = (value: string) => value.replace(/[\\/*?:[\]]/g, "-").slice(0, 31) || "Sheet1";

const downloadWorkbook = (filename: string, sheets: Array<{ name: string; rows: Record<string, unknown>[] }>) => {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const worksheetRows = sheet.rows.length ? sheet.rows : [{ info: "Tidak ada data" }];
    const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, toWorksheetName(sheet.name));
  });

  XLSX.writeFile(workbook, filename);
};

const TABLE_TONES: Record<string, { header: string; badge: string }> = {
  budget_plan_headers: {
    header: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  budget_plan_lines: {
    header: "border-sky-100 bg-sky-50/80 text-sky-900",
    badge: "border-sky-200 bg-sky-100 text-sky-800",
  },
  ledger_activities: {
    header: "border-violet-100 bg-violet-50/80 text-violet-900",
    badge: "border-violet-200 bg-violet-100 text-violet-800",
  },
  pr_headers: {
    header: "border-amber-100 bg-amber-50/80 text-amber-900",
    badge: "border-amber-200 bg-amber-100 text-amber-800",
  },
  pr_lines: {
    header: "border-orange-100 bg-orange-50/80 text-orange-900",
    badge: "border-orange-200 bg-orange-100 text-orange-800",
  },
  procurement_plan_tables: {
    header: "border-rose-100 bg-rose-50/80 text-rose-900",
    badge: "border-rose-200 bg-rose-100 text-rose-800",
  },
  procurement_plan_details: {
    header: "border-cyan-100 bg-cyan-50/80 text-cyan-900",
    badge: "border-cyan-200 bg-cyan-100 text-cyan-800",
  },
};

const ErpBrowser = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const domain = (searchParams.get("domain") || "finance") as "finance" | "procurement";
  const year = searchParams.get("year") || String(currentYear);
  const limit = searchParams.get("limit") || DEFAULT_LIMIT;
  const [payload, setPayload] = useState<TablePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(
    () => `${API_BASE}/erp/${domain}/tables?year=${year}&limit=${limit}`,
    [domain, year, limit]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Gagal mengambil data ERP ${domain}`);
        }

        const result = (await response.json()) as TablePayload;
        if (!cancelled) {
          setPayload(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [endpoint, domain]);

  const availableYears = payload?.slicer?.available_years?.length
    ? payload.slicer.available_years.map(String)
    : [String(currentYear), String(currentYear - 1)];

  const selectedTable = payload?.tables?.[0] || null;
  const domainTone =
    domain === "finance"
      ? {
          panel: "border-emerald-100 bg-emerald-50/70",
          pill: "border-emerald-200 bg-emerald-100 text-emerald-800",
        }
      : {
          panel: "border-amber-100 bg-amber-50/70",
          pill: "border-amber-200 bg-amber-100 text-amber-800",
        };

  const updateParams = (next: Record<string, string>) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => merged.set(key, value));
    setSearchParams(merged);
  };

  const handleDownloadAll = () => {
    if (!payload?.tables?.length) {
      return;
    }

    downloadWorkbook(
      `erp-browser-${domain}-${year}.xlsx`,
      payload.tables.map((table) => ({
        name: table.label,
        rows: table.rows,
      }))
    );
  };

  const handleDownloadTable = (table: TablePayload["tables"][number]) => {
    const summaryRows = [
      {
        metric: "source_row_count",
        value: table.summary?.source_row_count || 0,
      },
      {
        metric: "displayed_row_count",
        value: table.summary?.displayed_row_count || 0,
      },
      {
        metric: "column_count",
        value: table.summary?.column_count || 0,
      },
      ...(table.summary?.numeric_totals?.map((item) => ({
        metric: `total_${item.column}`,
        value: item.total,
        populated_rows: item.populated_rows,
      })) || []),
    ];

    downloadWorkbook(`erp-${domain}-${table.key}-${year}.xlsx`, [
      {
        name: "Summary",
        rows: summaryRows,
      },
      {
        name: table.key,
        rows: table.rows,
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-[#D3242B]" />
                <h1 className="text-2xl font-bold">ERP Table Browser</h1>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Melihat row per tabel dari `backend_erp` tanpa mengubah dashboard utama.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              >
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali ke Dashboard
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadAll}
                className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                disabled={!payload?.tables?.length}
              >
                <Download className="mr-2 h-4 w-4" />
                Download XLSX
              </Button>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${domainTone.panel}`}>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className={`rounded-full border px-3 py-1 ${domainTone.pill}`}>
                Domain: {domain === "finance" ? "Finance" : "Procurement"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                Tahun: {year}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                Limit: {limit} row
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Domain</div>
              <Select value={domain} onValueChange={(value) => updateParams({ domain: value })}>
                <SelectTrigger className="border-slate-300 bg-white text-slate-900 shadow-sm hover:border-slate-400 focus:ring-[#D3242B]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900 shadow-xl">
                  {DOMAIN_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-slate-700 focus:bg-rose-50 focus:text-rose-700"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tahun</div>
              <Select value={year} onValueChange={(value) => updateParams({ year: value })}>
                <SelectTrigger className="border-slate-300 bg-white text-slate-900 shadow-sm hover:border-slate-400 focus:ring-[#D3242B]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900 shadow-xl">
                  {availableYears.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className="text-slate-700 focus:bg-rose-50 focus:text-rose-700"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Limit Row</div>
              <Select value={limit} onValueChange={(value) => updateParams({ limit: value })}>
                <SelectTrigger className="border-slate-300 bg-white text-slate-900 shadow-sm hover:border-slate-400 focus:ring-[#D3242B]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900 shadow-xl">
                  {LIMIT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className="text-slate-700 focus:bg-rose-50 focus:text-rose-700"
                    >
                      {option} row
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-200">
            Endpoint: <span className="font-mono text-slate-50">{endpoint}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white p-16 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#D3242B]" />
              <p className="text-sm text-slate-500">Mengambil row ERP...</p>
            </div>
          </div>
        ) : error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6 text-sm text-red-600">{error}</CardContent>
          </Card>
        ) : (
          <>
            {payload?.warnings?.length ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-sm text-amber-700">Warnings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-amber-800">
                  {payload.warnings.map((warning) => (
                    <div key={warning.entity}>
                      <span className="font-semibold">{warning.entity}</span>: {warning.message}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-1">
              {payload?.tables?.map((table) => {
                const tone = TABLE_TONES[table.key] || {
                  header: "border-slate-200 bg-slate-50 text-slate-900",
                  badge: "border-slate-200 bg-slate-100 text-slate-700",
                };

                return (
                <Card key={table.key} className="overflow-hidden border-slate-200 shadow-sm">
                  <CardHeader className={`border-b ${tone.header}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-base">{table.label}</CardTitle>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                          {table.key}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTable(table)}
                        className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download XLSX
                      </Button>
                    </div>
                    <div className="text-sm text-slate-600">
                      Menampilkan {table.rows.length} dari {table.total_rows} row
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Filter source:{" "}
                      <span className="font-mono text-slate-800">
                        {payload.source_metadata?.[
                          table.key === "budget_plan_headers"
                            ? "BudgetPlanningEntries"
                            : table.key === "budget_plan_lines"
                              ? "KREBudgetPlanningEntriesLines"
                              : table.key === "ledger_activities"
                                ? "GeneralLedgerActivities"
                                : table.key === "pr_headers"
                                  ? "PurchaseRequisitionHeaders"
                                  : table.key === "pr_lines"
                                    ? "PurchaseRequisitionLinesV2"
                                    : table.key === "procurement_plan_tables"
                                      ? "ProcurementPlanTables"
                                      : "ProcurementPlanDetails"
                        ]?.filter || "-"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-800">Ringkasan Tabel</div>
                        <div className="text-[11px] text-slate-500">Dihitung dari seluruh row source tabel ini</div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Row Source</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">
                            {formatSummaryNumber(table.summary?.source_row_count || 0)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Row Ditampilkan</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">
                            {formatSummaryNumber(table.summary?.displayed_row_count || 0)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jumlah Kolom</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">
                            {formatSummaryNumber(table.summary?.column_count || 0)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Total Kolom Numerik
                        </div>
                        {table.summary?.numeric_totals?.length ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {table.summary.numeric_totals.map((item) => (
                              <div key={`${table.key}-${item.column}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-semibold text-slate-700">{item.column}</div>
                                <div className="mt-1 text-base font-bold text-slate-900">
                                  {formatSummaryNumber(item.total)}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  Terisi di {formatSummaryNumber(item.populated_rows)} row
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            Belum ada kolom numerik yang bisa diringkas untuk tabel ini.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                    <Table className="bg-white">
                      <TableHeader className="bg-slate-100">
                        <TableRow className="hover:bg-slate-100">
                          {table.columns.map((column) => (
                            <TableHead key={column} className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={Math.max(table.columns.length, 1)} className="py-8 text-center text-slate-500">
                              Tidak ada row
                            </TableCell>
                          </TableRow>
                        ) : (
                          table.rows.map((row, index) => (
                            <TableRow key={`${table.key}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                              {table.columns.map((column) => (
                                <TableCell key={column} className="max-w-[320px] whitespace-nowrap border-b border-slate-100 font-mono text-xs text-slate-700">
                                  {stringifyCell(row[column])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>

            {selectedTable ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Catatan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-600">
                  <p>Halaman ini untuk inspeksi row hasil tarik ERP per tabel, bukan agregasi dashboard.</p>
                  <p>Kalau Anda ingin saya bedah tabel tertentu lebih dalam, sebut nama tabelnya dan tahun yang ingin dicek.</p>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default ErpBrowser;
