import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    DollarSign, TrendingUp, Wallet, ShoppingCart, Target, Sun, Moon,
    ArrowUp, ArrowDown, PieChart as PieChartIcon, BrainCircuit, Instagram,
    Facebook, Twitter, Youtube, Linkedin, Hash, Users, CheckCircle,
    Building, AlertTriangle, Package,
    Briefcase,
    Smile,
    Newspaper,
    Share2,
    Award,
    LineChart as LineChartIconLucide,
    ChevronLeft, ChevronRight,
    Calculator,
    CalendarClock,
    History,
    ArrowRightCircle,
    FileCheck,
    Percent
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, LabelList, ComposedChart
} from 'recharts';

import {
    departmentBudgetData,
    procurementStatusData as staticProcurementData,
    savingsData
} from '../data';

// --- SVG Icons ---
const Loader2 = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>);

// --- Utility & Constants ---
const AUTO_SLIDE_INTERVAL = 15000;
const DASHBOARD_REFRESH_INTERVAL = 60000;
const DEPARTMENTS_PER_SLIDE = 5;

// Helper function to format a Date object
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

// -- Helper Function untuk Format Mata Uang --
const formatCurrency = (value) => {
    if (typeof value !== 'number') return value;

    const format = (num) =>
        num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    if (value >= 1e9) {
        return format(value / 1e9) + "M";
    }
    if (value >= 1e6) {
        return format(value / 1e6) + "Jt";
    }
    if (value >= 1e3) {
        return format(value / 1e3) + "K";
    }

    return format(value);
};

// --- COMPONENTS ---

const BudgetSummaryCharts = ({ isLight, budgetTotals, financeData }) => {

    // --- 1. DATA CHART ATAS (Total Penyerapan) ---
    // Menggunakan data yang sudah Anda hitung sebelumnya
    const absorptionPercent = budgetTotals.penyerapan.persentase;
    const remainingPercent = 100 - absorptionPercent;

    const data1 = [
        { name: 'Absorbed', value: absorptionPercent },
        { name: 'Remaining', value: remainingPercent },
    ];

    // Warna Donut: Merah (LRT Style) & Abu-abu
    const COLORS1 = ['#D3242B', isLight ? '#f1f5f9' : '#334155'];

    // --- 2. DATA CHART BAWAH (Breakdown Performa OPEX vs CAPEX) ---
    // Kita perlu menghitung "Berapa % OPEX yang sudah terpakai?" bukan "Berapa % OPEX dari total anggaran"

    // Ambil detail angka dari financeData (yang dikirim dari Parent)
    const totalData = financeData?.total_lrtj || {};

    // A. Hitung Performa OPEX
    // Fallback ke proposal jika realokasi kosong
    const opexBudget = totalData.anggaran_realokasi_2025_opex || totalData.anggaran_proposal_opex || 0;
    const opexUsed = (totalData.opex_verifikasi_total || 0) + (totalData.opex_ppa_spuk_kk_total || 0);
    const opexPerformance = opexBudget > 0 ? (opexUsed / opexBudget) * 100 : 0;

    // B. Hitung Performa CAPEX
    // Fallback ke proposal jika realokasi kosong
    const capexBudget = totalData.anggaran_realokasi_2025_capex || totalData.anggaran_proposal_capex || 0;
    const capexUsed = totalData.realisasi_capex_total || 0;
    const capexPerformance = capexBudget > 0 ? (capexUsed / capexBudget) * 100 : 0;

    // --- Helper Component: Progress Bar ---
    const ProgressBar = ({ label, percent, colorClass, valueText }) => {
        // Logika: Jika progress > 40%, teks masuk ke dalam (putih). Jika tidak, teks di luar (gelap).
        const isTextInside = percent > 40;

        return (
            <div className="mb-3 last:mb-0">
                <div className="flex justify-between items-end mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {label}
                    </span>
                    <span className={`text-[10px] font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                        {percent.toFixed(1)}%
                    </span>
                </div>

                {/* Container Bar */}
                <div className={`relative w-full h-4 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>

                    {/* Active Bar (Colored) */}
                    <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 ${colorClass}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                    >
                        {/* Teks DI DALAM (Hanya muncul jika bar cukup panjang) */}
                        {isTextInside && (
                            <span className="text-[9px] font-bold text-white whitespace-nowrap drop-shadow-sm">
                                {valueText}
                            </span>
                        )}
                    </div>

                    {/* Teks DI LUAR (Muncul jika bar terlalu pendek) */}
                    {!isTextInside && (
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-end pr-2">
                            <span className={`text-[9px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                {valueText}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Format Miliar helper kecil untuk display di bawah bar
    const toMiliar = (val) => (val / 1_000_000_000).toFixed(1) + ' M';

    return (
        <div className={`rounded-xl border shadow-sm p-3 flex flex-col h-auto min-h-[260px] transition-colors ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>

            {/* Header */}
            <h2 className={`text-xs font-bold mb-3 uppercase border-b pb-0 flex items-center gap-1 ${isLight ? 'text-[#D3242B] border-slate-100' : 'text-[#F6821F] border-slate-800'}`}>
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Rasio Penyerapan Anggaran</span>
            </h2>

            <div className="flex-1 flex flex-col gap-1">

                {/* BAGIAN 1: DONUT CHART (Total Penyerapan) */}
                <div className="flex items-center justify-center py-2">
                    <div className="relative w-24 h-24">
                        {/* Text Tengah Donut */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-md font-extrabold ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`}>
                                {absorptionPercent.toFixed(1)}%
                            </span>
                            <span className={`text-[9px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                Total
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data1}
                                    dataKey="value"
                                    innerRadius={32}
                                    outerRadius={42}
                                    startAngle={90}
                                    endAngle={-270}
                                    stroke="none"
                                    cornerRadius={4}
                                    paddingAngle={2}
                                >
                                    {data1.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS1[index % COLORS1.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend Sederhana di Samping */}
                    <div className="ml-4 flex flex-col justify-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#D3242B]"></div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Terserap</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`}></div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Sisa</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className={`border-t border-dashed ${isLight ? 'border-slate-200' : 'border-slate-700'}`}></div>

                {/* BAGIAN 2: PROGRESS BARS (Detail OPEX & CAPEX) */}
                <div className="flex-1 flex flex-col justify-center pt-1">
                    {/* Bar 1: OPEX (Biasanya Hijau/Teal) */}
                    <ProgressBar
                        label="Penyerapan OPEX"
                        percent={opexPerformance}
                        colorClass="bg-emerald-500"
                        valueText={`${toMiliar(opexUsed)} / ${toMiliar(opexBudget)}`}
                    />

                    {/* Bar 2: CAPEX (Biasanya Biru) */}
                    <ProgressBar
                        label="Penyerapan CAPEX"
                        percent={capexPerformance}
                        colorClass="bg-blue-600"
                        valueText={`${toMiliar(capexUsed)} / ${toMiliar(capexBudget)}`}
                    />
                </div>

            </div>
        </div>
    );
};

// --- UPDATED: Menerima data dari props, tidak fetch sendiri ---
const InteractiveProcurementChart = ({ isLight, data }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // --- Styling Constants ---
    const gridColor = isLight ? '#e2e8f0' : '#334155';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const colorHPS = "#4472C4";
    const colorKomitmen = "#ED7D31";
    const colorPR = "#5B9BD5";

    // --- Helpers ---
    const shortenMonth = (nama) => {
        if (!nama) return "";
        return nama.substring(0, 3).charAt(0).toUpperCase() + nama.substring(1, 3).toLowerCase();
    };

    const formatAxisCurrency = (value) => {
        if (value === 0) return '0';
        return (value / 1_000_000_000).toFixed(1);
    };

    // --- 2. Data Processing ---
    const allChartData = useMemo(() => {
        if (!data) return [];
        const { dashboardData, divisionalProcurementData } = data;

        const rawTotal = dashboardData?.data_per_bulan || [];
        const totalView = {
            divisi: "Total Keseluruhan",
            data: rawTotal.map(month => ({
                bulan: shortenMonth(month.bulan),
                hps: month.HPS,
                komitmen_po: month.Komitmen_PO,
                pr: month.PR
            }))
        };

        const rawDivisions = divisionalProcurementData?.data || [];
        const divisionalViews = rawDivisions.map(div => ({
            divisi: div.divisi,
            data: div.bulan.map(month => ({
                bulan: shortenMonth(month.nama),
                hps: month.hps,
                komitmen_po: month.komitmen_po,
                pr: month.pr
            }))
        }));

        return [totalView, ...divisionalViews];
    }, [data]);

    // --- 3. Slider Logic ---
    const handleNext = useCallback(() => {
        if (allChartData.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % allChartData.length);
    }, [allChartData.length]);

    const handlePrev = useCallback(() => {
        if (allChartData.length === 0) return;
        setCurrentIndex((prev) => (prev - 1 + allChartData.length) % allChartData.length);
    }, [allChartData.length]);

    useEffect(() => {
        const sliderInterval = setInterval(handleNext, 15000);
        return () => clearInterval(sliderInterval);
    }, [currentIndex, handleNext]);

    // --- Custom Labels ---
    const CustomBarLabel = (props) => {
        const { x, y, width, height, value } = props;
        if (!value || value === 0) return null;

        let formattedText = "";
        if (Math.abs(value) >= 1_000_000_000) {
            formattedText = (value / 1_000_000_000).toFixed(1) + "M";
        } else if (Math.abs(value) >= 1_000_000) {
            formattedText = (value / 1_000_000).toFixed(0) + "Jt";
        } else {
            formattedText = value.toLocaleString();
        }
        formattedText = formattedText.replace(".0M", "M");

        const isTall = height > 40;
        const cx = x + width / 2;
        const cy = isTall ? y + 25 : y - 15;
        const fill = isTall ? "#FFFFFF" : (isLight ? "#334155" : "#cbd5e1");
        const anchor = isTall ? "end" : "start";

        return (
            <text
                x={cx}
                y={cy}
                fill={fill}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={9}
                fontWeight="bold"
                transform={`rotate(-90, ${cx}, ${cy})`}
                style={{ pointerEvents: 'none', textShadow: isTall ? '0px 0px 2px rgba(0,0,0,0.5)' : 'none' }}
            >
                {formattedText}
            </text>
        );
    };

    const CustomLineLabel = (props) => {
        const { x, y, value } = props;
        if (!value || value === 0) return null;
        const yPosBox = y - 40;
        const yPosText = y - 31;

        return (
            <g>
                <line
                    x1={x} y1={y}
                    x2={x} y2={yPosBox + 14}
                    stroke={colorPR}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.8}
                />
                <rect
                    x={x - 10}
                    y={yPosBox}
                    width={20}
                    height={16}
                    rx={4}
                    fill={isLight ? "#0f172a" : "#f8fafc"}
                    opacity={0.9}
                    stroke={isLight ? "none" : "#334155"}
                />
                <text
                    x={x}
                    y={yPosText}
                    fill={isLight ? "#ffffff" : "#0f172a"}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontWeight="bold"
                >
                    {value}
                </text>
            </g>
        );
    };

    if (!data) return <div className="h-full flex items-center justify-center text-xs text-slate-500">Loading Data...</div>;

    const currentView = allChartData[currentIndex] || { divisi: 'Loading...', data: [] };

    return (
        <div className={`rounded-lg p-3 h-full flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <header className={`flex justify-between items-center text-xs font-bold uppercase border-b pb-1 mb-2 flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <div className={`flex items-center gap-1.5 ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`}>
                    <LineChartIconLucide className="w-3.5 h-3.5" />
                    <span>Procurement Activity 2025</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrev} className={`p-1 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}>
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`text-center font-bold px-2 truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`} style={{ minWidth: '180px', maxWidth: '200px' }}>
                        {currentView.divisi}
                    </span>
                    <button onClick={handleNext} className={`p-1 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={currentView.data}
                        margin={{ top: 50, right: 0, left: 0, bottom: 0 }}
                        barGap={8}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis
                            dataKey="bulan"
                            fontSize={10}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            fontSize={10}
                            tickFormatter={formatAxisCurrency}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                            label={{ value: 'Miliar (Bio)', angle: -90, position: 'insideLeft', style: { fill: textColor, fontSize: '9px', textAnchor: 'middle' }, offset: 10 }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            fontSize={10}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                            domain={['auto', dataMax => Math.ceil(dataMax * 1.2)]}
                            label={{ value: 'QTY', angle: 90, position: 'insideRight', style: { fill: textColor, fontSize: '9px', textAnchor: 'middle' }, offset: 5 }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                        />
                        <Bar yAxisId="left" dataKey="hps" name="HPS" fill={colorHPS} barSize={16} radius={[4, 4, 0, 0]}>
                            <LabelList content={<CustomBarLabel />} />
                        </Bar>
                        <Bar yAxisId="left" dataKey="komitmen_po" name="Komitmen PO" fill={colorKomitmen} barSize={16} radius={[4, 4, 0, 0]}>
                            <LabelList content={<CustomBarLabel />} />
                        </Bar>
                        <Line yAxisId="right" type="linear" dataKey="pr" name="Jumlah PR" stroke={colorPR} strokeWidth={2} dot={{ r: 4, fill: colorPR, strokeWidth: 1 }} activeDot={{ r: 5 }}>
                            <LabelList content={<CustomLineLabel />} />
                        </Line>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const SavingsValueChart = ({ isLight, chartData }) => {
    if (!chartData || chartData.length === 0) {
        return (
            <NoDataCard
                isLight={isLight}
                title="Analisis Penghematan (Nilai)"
                icon={Award}
                message="Data bulanan tidak tersedia"
            />
        );
    }

    const gridColor = isLight ? "#e2e8f0" : "#334155";
    const textColor = isLight ? "#475569" : "#94a3b8";

    const monthMap = {
        Januari: "Jan", Februari: "Feb", Maret: "Mar", April: "Apr",
        Mei: "Mei", Juni: "Jun", Juli: "Jul", Agustus: "Ags",
        September: "Sep", Oktober: "Okt", November: "Nov", Desember: "Des",
    };

    const formattedData = chartData.map((item) => ({
        ...item,
        Bulan: monthMap[item.Bulan] || item.Bulan,
    }));

    return (
        <div className={`rounded-lg p-3 h-full flex flex-col ${isLight ? "bg-white border border-slate-200 shadow-sm" : "bg-slate-900 border border-slate-800"}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 flex items-center gap-1.5 ${isLight ? "text-[#D3242B] border-slate-200" : "text-[#F6821F] border-slate-800"}`}>
                <Award className="w-3.5 h-3.5" />
                Analisis Penghematan (Nilai)
            </h2>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="Bulan" fontSize={10} tick={{ fill: textColor }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={formatCurrency} fontSize={10} tick={{ fill: textColor }} axisLine={false} tickLine={false} />
                        <Tooltip
                            formatter={(v) => formatCurrency(v)}
                            contentStyle={{ backgroundColor: isLight ? "white" : "#0f172a", border: `1px solid ${gridColor}`, borderRadius: "6px", fontSize: "12px" }}
                            labelStyle={{ color: textColor }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
                        <Bar dataKey="HPS" fill="#3b82f6" name="HPS" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Aktual" fill="#14b8a6" name="Aktual" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Selisih_HPS" fill="#f97316" name="Selisih HPS" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const SavingsPercentageChart = ({ isLight, chartData }) => {
    if (!chartData || chartData.length === 0) {
        return <NoDataCard isLight={isLight} title="Analisis Penghematan (%)" icon={TrendingUp} message="Data bulanan tidak tersedia" />;
    }

    const gridColor = isLight ? '#e2e8f0' : '#334155';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const monthMap = {
        Januari: "Jan", Februari: "Feb", Maret: "Mar", April: "Apr",
        Mei: "Mei", Juni: "Jun", Juli: "Jul", Agustus: "Ags",
        September: "Sep", Oktober: "Okt", November: "Nov", Desember: "Des",
    };

    const formattedData = chartData.map((item) => ({
        ...item,
        Bulan: monthMap[item.Bulan] || item.Bulan,
    }));

    return (
        <div className={`rounded-lg p-3 h-full flex flex-col ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 flex items-center gap-1.5 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                Analisis Penghematan (%)
            </h2>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="Bulan" fontSize={10} tick={{ fill: textColor }} axisLine={false} tickLine={false} />
                        <YAxis unit="%" fontSize={10} tick={{ fill: textColor }} axisLine={false} tickLine={false} />
                        <Tooltip
                            formatter={(v) => `${v}%`}
                            contentStyle={{ backgroundColor: isLight ? 'white' : '#0f172a', border: `1px solid ${gridColor}`, borderRadius: '6px', fontSize: '12px' }}
                            labelStyle={{ color: textColor }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Line type="monotone" dataKey="Persen_Saving_HPS_vs_Aktual" stroke="#ef4444" name="% HPS vs Aktual" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Persen_Saving_Penawaran" stroke="#10b981" name="% Saving Penawaran" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const SavingsSlider = ({ isLight, data }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const slides = ['savings_value_chart', 'savings_percent_chart'];
    const totalSlides = slides.length;

    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        return data
            .filter(item => item.Bulan && item.No && !item.Bulan.includes('Total'))
            .map(item => ({
                ...item,
                Persen_Saving_HPS_vs_Aktual: parseFloat(item.Persen_Saving_HPS_vs_Aktual) || 0,
                Persen_Saving_Penawaran: parseFloat(item.Persen_Saving_Penawaran) || 0,
            }));
    }, [data]);

    const handleNext = useCallback(() => {
        setCurrentSlide(prev => (prev + 1) % totalSlides);
    }, [totalSlides]);

    useEffect(() => {
        const sliderInterval = setInterval(handleNext, 15000);
        return () => clearInterval(sliderInterval);
    }, [handleNext]);

    let content;
    switch (slides[currentSlide]) {
        case 'savings_value_chart': content = <SavingsValueChart isLight={isLight} chartData={chartData} />; break;
        case 'savings_percent_chart': content = <SavingsPercentageChart isLight={isLight} chartData={chartData} />; break;
        default: content = null;
    }

    return <div className="h-full min-h-[350px] lg:min-h-0 transition-all duration-300">{content}</div>;
};

// --- UPDATED: OnProgressKpis (Menerima data via props) ---
const OnProgressKpis = ({ isLight, data }) => {
    // Fallback value
    const safeData = data || {
        ongoing_request: 0,
        on_proses_pengadaan: 0,
        estimasi_serapan: 0
    };

    // Style colors
    const cardBg = isLight ? "bg-white" : "bg-slate-900";
    const borderColor = isLight ? "border-slate-200" : "border-slate-800";
    const labelColor = isLight ? "text-slate-500" : "text-slate-400";

    return (
        <div className={`rounded-xl border shadow-sm overflow-hidden mb-0 ${cardBg} ${borderColor}`}>
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">

                {/* Item 1: Jumlah PR (Count) */}
                <div className="p-3 flex flex-col justify-center items-center text-center">
                    <div className={`mb-1 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        <Briefcase className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] font-bold uppercase mb-0.5 ${labelColor}`}>Jumlah PR Ongoing</span>
                    <span className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {safeData.ongoing_request}
                    </span>
                </div>

                {/* Item 2: Nilai PR (Value) - Amber */}
                <div className="p-3 flex flex-col justify-center items-center text-center bg-amber-50/40 dark:bg-amber-900/10">
                    <div className="mb-1 p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600">
                        <Loader2 className="w-4 h-4 animate-spin-slow" />
                    </div>
                    <span className={`text-[9px] font-bold uppercase mb-0.5 text-amber-600/80`}>Total PR</span>
                    <span className="text-lg font-bold text-amber-600">
                        {formatCurrency(safeData.on_proses_pengadaan * 1_000_000_000)}
                    </span>
                </div>

                {/* Item 3: Estimasi Serapan - Slate/Netral */}
                <div className="p-3 flex flex-col justify-center items-center text-center">
                    <div className={`mb-1 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        <Calculator className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] font-bold uppercase mb-0.5 ${labelColor}`}>Est. Serapan</span>
                    <span className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {formatCurrency(safeData.estimasi_serapan * 1_000_000_000)}
                    </span>
                </div>

            </div>
        </div>
    );
};

const OnProgressPO = ({ isLight, data }) => {
    if (!data) return null;

    const kpis = [
        { title: "Lintas Tahun 2026", value: formatCurrency(data.lintastahun2026 * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Recurring 2026", value: formatCurrency(data.recurring2026 * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Terserap di 2025", value: formatCurrency(data.terserap_2025 * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Carry Over 2024", value: formatCurrency(data.carry_over * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Recurring 2024", value: formatCurrency(data.recurring * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Estimasi Serapan 2025", value: formatCurrency(data.estimasi_serapan_2025 * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Serapan on Proses 2025", value: formatCurrency(data.serapan_onproses_2025 * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Total Sementara", value: formatCurrency(data.total_sementara * 1_000_000_000), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        {
            title: "Total % Serapan",
            value: (data.total_persentase_serapan * 100).toFixed(2) + "%",
            icon: Briefcase,
            color: isLight ? 'text-slate-900' : 'text-white'
        }
    ];

    const formatMiliar = (val) => {
        if (!val) return "0 M";
        return val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M";
    };

    const cardBg = isLight ? "bg-white" : "bg-slate-900";
    const sectionBg = isLight ? "bg-slate-50" : "bg-slate-800/50";
    const borderColor = isLight ? "border-slate-200" : "border-slate-800";
    const textColor = isLight ? "text-slate-600" : "text-slate-300";
    const valueColor = isLight ? "text-slate-800" : "text-white";

    return (
        <div className={`rounded-xl border shadow-sm overflow-hidden ${cardBg} ${borderColor}`}>

            {/* HEADER SECTION: KEY METRICS (Total Sementara & Persentase) */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
                <div className="p-4 flex flex-col items-center justify-center text-center bg-gradient-to-b from-transparent to-emerald-50/30 dark:to-emerald-900/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1 flex items-center gap-1">
                        <Calculator className="w-3 h-3" /> Total Sementara
                    </span>
                    <span className={`text-2xl font-extrabold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {formatMiliar(data.total_sementara)}
                    </span>
                </div>
                <div className="p-4 flex flex-col items-center justify-center text-center bg-gradient-to-b from-transparent to-blue-50/30 dark:to-blue-900/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Total % Serapan
                    </span>
                    <span className={`text-2xl font-extrabold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>
                        {data.persen_total_serapan?.toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* BODY SECTION: 3 PILAR UTAMA 2025 */}
            <div className="p-4 grid grid-cols-3 gap-4">
                {/* Terserap */}
                <div className="text-center">
                    <p className={`text-[10px] font-semibold uppercase mb-1 ${textColor}`}>Terserap 2025</p>
                    <p className={`text-lg font-bold ${valueColor}`}>{formatMiliar(data.terserap_2025)}</p>
                </div>
                {/* Estimasi */}
                <div className={`text-center border-x ${borderColor}`}>
                    <p className={`text-[10px] font-semibold uppercase mb-1 ${textColor}`}>Estimasi Serapan</p>
                    <p className={`text-lg font-bold ${valueColor}`}>{formatMiliar(data.estimasi_serapan_2025)}</p>
                </div>
                {/* On Proses */}
                <div className="text-center">
                    <p className={`text-[10px] font-semibold uppercase mb-1 ${textColor}`}>Serapan On-Proses</p>
                    <p className={`text-lg font-bold text-amber-500`}>{formatMiliar(data.serapan_onproses_2025)}</p>
                </div>
            </div>

            {/* FOOTER SECTION: HISTORIS & MASA DEPAN (Split Background) */}
            <div className={`grid grid-cols-2 border-t ${borderColor}`}>

                {/* Kiri: 2024 (Masa Lalu) */}
                <div className={`p-3 ${sectionBg} border-r ${borderColor}`}>
                    <div className="flex items-center gap-2 mb-2 opacity-70">
                        <History className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase">Beban 2024</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className={textColor}>Carry Over</span>
                            <span className={`font-semibold ${valueColor}`}>{formatMiliar(data.carry_over)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className={textColor}>Recurring</span>
                            <span className={`font-semibold ${valueColor}`}>{formatMiliar(data.recurring)}</span>
                        </div>
                    </div>
                </div>

                {/* Kanan: 2026 (Masa Depan) */}
                <div className="p-3">
                    <div className="flex items-center gap-2 mb-2 opacity-70 text-indigo-600">
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase">2026</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className={textColor}>Lintas Tahun</span>
                            <span className={`font-semibold ${valueColor}`}>{formatMiliar(data.lintastahun2026)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className={textColor}>Recurring</span>
                            <span className={`font-semibold ${valueColor}`}>{formatMiliar(data.recurring2026)}</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const ProcurementStatusChart = ({ isLight, data }) => {
    // Guard clause
    if (!data || !data.divisi) return null;

    // Filter & Map Data
    const chartData = data.divisi.filter(
        d => d.ongoing_request > 0 || d.on_proses_pengadaan > 0
    ).map(d => ({
        ...d,
        label: `${d.divisi}`
    }));

    // --- Styling Constants ---
    const gridColor = isLight ? '#e2e8f0' : '#334155';
    const textColor = isLight ? '#475569' : '#94a3b8';

    // Warna spesifik untuk On Process (Orange untuk Value, Biru untuk Count)
    const colorValue = "#f97316";
    const colorCount = "#3b82f6";

    // --- Helpers (Diambil dari Reference Style) ---
    const formatAxisCurrency = (value) => value.toFixed(1);

    // --- Custom Labels (Diambil Persis dari Reference Style) ---
    const CustomBarLabel = (props) => {
        const { x, y, width, height, value } = props;
        if (!value || value === 0) return null;

        // Formatting Value (Raw Rupiah -> Miliar "M")
        let formattedText = "";
        if (Math.abs(value) >= 1_000_000_000) {
            formattedText = value.toFixed(2) + "M";
        } else if (Math.abs(value) >= 1_000_000) {
            formattedText = (value / 1_000_000).toFixed(0) + "Jt";
        } else {
            formattedText = value.toLocaleString();
        }
        formattedText = formattedText.replace(".0M", "M");

        // Logika Posisi & Warna Kontras
        const isTall = height > 20;
        const cx = x + width / 2;
        const cy = isTall ? y + 22 : y - 55;
        const fill = isTall ? "#FFFFFF" : (isLight ? "#334155" : "#cbd5e1");
        const anchor = isTall ? "end" : "start";

        return (
            <text
                x={cx}
                y={cy}
                fill={fill}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={9}
                fontWeight="bold"
                transform={`rotate(-90, ${cx}, ${cy})`}
                style={{ pointerEvents: 'none', textShadow: isTall ? '0px 0px 2px rgba(0,0,0,0.5)' : 'none' }}
            >
                {formattedText}
            </text>
        );
    };

    const CustomLineLabel = (props) => {
        const { x, y, value } = props;
        if (!value || value === 0) return null;

        // Posisi Box Label (di atas titik)
        const yPosBox = y - 25;
        const yPosText = y - 16;

        return (
            <g>
                {/* Garis Putus-putus */}
                <line
                    x1={x} y1={y}
                    x2={x} y2={yPosBox + 4}
                    stroke={colorCount}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.8}
                />
                {/* Kotak Background */}
                <rect
                    x={x - 10}
                    y={yPosBox}
                    width={20}
                    height={16}
                    rx={4}
                    fill={isLight ? "#0f172a" : "#f8fafc"}
                    opacity={0.9}
                    stroke={isLight ? "none" : "#334155"}
                />
                {/* Teks Angka */}
                <text
                    x={x}
                    y={yPosText}
                    fill={isLight ? "#ffffff" : "#0f172a"}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontWeight="bold"
                >
                    {value}
                </text>
            </g>
        );
    };

    return (
        <div className={`rounded-lg p-3 h-full flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            {/* Header Style Reference */}
            <header className={`flex justify-between items-center text-xs font-bold uppercase border-b pb-1 mb-2 flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <div className={`flex items-center gap-1.5 ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Laporan Pengadaan 2025 - On Process</span>
                </div>
            </header>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 50, right: 0, left: 0, bottom: 0 }} // Top 50 penting untuk label Line
                        barGap={8}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

                        <XAxis
                            dataKey="kode"
                            fontSize={10}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                            interval={0}
                            dy={5}
                        />

                        {/* Y-Axis Kiri (Value Rupiah) */}
                        <YAxis
                            yAxisId="left"
                            fontSize={10}
                            tickFormatter={formatAxisCurrency}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                            label={{ value: 'Value (Miliar)', angle: -90, position: 'insideLeft', style: { fill: textColor, fontSize: '9px', textAnchor: 'middle' }, offset: 10 }}
                        />

                        {/* Y-Axis Kanan (Count) */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            fontSize={10}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                            domain={['auto', dataMax => Math.ceil(dataMax * 1.5)]} // Memberi ruang lebih di atas
                            label={{ value: 'Count', angle: 90, position: 'insideRight', style: { fill: textColor, fontSize: '9px', textAnchor: 'middle' }, offset: 5 }}
                        />

                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                            formatter={(value) => {
                                if (value === 'ongoing_request') return 'Jumlah Request (Count)';
                                if (value === 'on_proses_pengadaan') return 'Nilai (Miliar)';
                                return value;
                            }}
                        />

                        {/* Bar: On Process Value */}
                        <Bar
                            yAxisId="left"
                            dataKey="on_proses_pengadaan"
                            fill={colorValue}
                            barSize={24}
                            radius={[4, 4, 0, 0]}
                            style={{ zIndex: 3 }}
                        >
                            <LabelList content={<CustomBarLabel />} />
                        </Bar>

                        {/* Line: Ongoing Count */}
                        <Line
                            yAxisId="right"
                            dataKey="ongoing_request"
                            stroke={colorCount}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            style={{ zIndex: 1 }}
                        >
                            <LabelList content={<CustomLineLabel />} />
                        </Line>

                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

interface NoDataCardProps {
    isLight: boolean;
    title: string;
    icon?: React.ElementType;
    message: string;
}

const NoDataCard = memo(({ isLight, title, icon: Icon, message }: NoDataCardProps) => (
    <div className={`rounded-lg p-3 flex flex-col flex-1 h-full transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
        <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 flex items-center gap-1.5 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{title}</span>
        </h2>
        <div className="flex-1 min-h-0 flex items-center justify-center">
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {message}
            </p>
        </div>
    </div>
));

const DepartmentBudgetPerformanceChart = ({ isLight, data }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const gridColor = isLight ? '#e2e8f0' : '#334155';
    const textColor = isLight ? '#475569' : '#94a3b8';

    const allChartData = useMemo(() => {
        if (!data) return [];

        return data.overall_departments
            .map(item => ({
                ...item,
                label: item.departemen,
                anggaran_awal: item.anggaran_proposal_total,
                anggaran_realokasi: item.anggaran_realokasi_2025_total,
                penyerapan_total: item.penyerapan_total,
                penyerapan_persen: item.penyerapan_persen,
            }))
            .sort((a, b) => b.anggaran_realokasi - a.anggaran_realokasi);
    }, [data]);

    const totalPages = Math.ceil(allChartData.length / DEPARTMENTS_PER_SLIDE);

    const currentChartData = allChartData.slice(
        currentPage * DEPARTMENTS_PER_SLIDE,
        (currentPage + 1) * DEPARTMENTS_PER_SLIDE
    );

    const handleNext = useCallback(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
    }, [totalPages]);

    const handlePrev = useCallback(() => {
        setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
    }, [totalPages]);

    useEffect(() => {
        const sliderInterval = setInterval(handleNext, AUTO_SLIDE_INTERVAL);
        return () => clearInterval(sliderInterval);
    }, [currentPage, handleNext]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = allChartData.find(d => d.label === label);
            if (!data) return null;

            return (
                <div className={`p-2 rounded-md shadow-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                    <p className={`text-xs font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{data.label}</p>

                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="font-semibold">Anggaran Awal:</span> {formatCurrency(data.anggaran_awal)}
                    </p>

                    <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        <span className="font-semibold">Anggaran Realokasi:</span> {formatCurrency(data.anggaran_realokasi)}
                    </p>

                    <p className="text-xs text-[#D3242B]">
                        <span className="font-semibold">Penyerapan:</span> {formatCurrency(data.penyerapan_total)} ({data.penyerapan_persen.toFixed(1)}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={`rounded-lg p-3 h-full flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <header className={`flex justify-between items-center text-xs font-bold uppercase border-b pb-1 mb-2 flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <div className={`flex items-center gap-1.5 ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`}>
                    <Users className="w-3.5 h-3.5" />
                    <span>Kinerja Anggaran Departemen</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrev}
                        className={`p-1 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}
                        aria-label="Previous Page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`text-center font-bold px-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                        Halaman {currentPage + 1} / {totalPages}
                    </span>
                    <button
                        onClick={handleNext}
                        className={`p-1 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}
                        aria-label="Next Page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={currentChartData}
                        margin={{ top: 1, right: 10, left: -40, bottom: 10 }}
                        barGap={5}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis
                            type="number"
                            fontSize={10}
                            tickFormatter={formatCurrency}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                        />
                        <YAxis
                            type="category"
                            dataKey="label"
                            fontSize={9}
                            width={180}
                            tick={{ fill: textColor }}
                            axisLine={{ stroke: gridColor }}
                            interval={0}
                            tickFormatter={(value) => value.length > 30 ? value.substring(0, 30) + '...' : value}
                        />
                        <Tooltip content={CustomTooltip} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />

                        <Bar dataKey="anggaran_awal" name="Anggaran Awal" fill={isLight ? '#cbd5e1' : '#475569'} radius={[4, 4, 0, 0]}>
                            <LabelList
                                dataKey="anggaran_awal"
                                position="insideRight"
                                fill={isLight ? '#334155' : '#e2e8f0'}
                                fontSize={9}
                                fontWeight="bold"
                                formatter={formatCurrency}
                            />
                        </Bar>
                        <Bar dataKey="anggaran_realokasi" name="Anggaran Realokasi" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            <LabelList
                                dataKey="anggaran_realokasi"
                                position="insideRight"
                                fill="#ffffff"
                                fontSize={9}
                                fontWeight="bold"
                                formatter={formatCurrency}
                            />
                        </Bar>
                        <Bar dataKey="penyerapan_total" name="Penyerapan" fill="#D3242B" radius={[4, 4, 0, 0]}>
                            <LabelList
                                dataKey="penyerapan_total"
                                position="insideRight"
                                fill="#ffffff"
                                fontSize={9}
                                fontWeight="bold"
                                formatter={formatCurrency}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const SavingsKpis = ({ isLight, data }) => {
    if (!data) return null;

    // Style colors
    const cardBg = isLight ? "bg-white" : "bg-slate-900";
    const borderColor = isLight ? "border-slate-200" : "border-slate-800";
    const labelColor = isLight ? "text-slate-500" : "text-slate-400";
    const valueColor = isLight ? "text-slate-800" : "text-white";

    return (
        <div className={`rounded-xl border shadow-sm overflow-hidden mb-0 ${cardBg} ${borderColor}`}>
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">

                {/* Item 1: Total HPS (Anggaran/Pagu) - Biru */}
                <div className="p-3 relative flex flex-col justify-between h-full">
                    <div className="absolute top-2 right-2 opacity-10">
                        <DollarSign className="w-8 h-8 text-blue-600" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelColor}`}>
                        Total HPS
                    </span>
                    <span className={`text-lg font-extrabold text-blue-600`}>
                        {formatCurrency(data.total_hps_2025 * 1_000_000_000)}
                    </span>
                </div>

                {/* Item 2: Komitmen PO (Kontrak) - Emerald */}
                <div className="p-3 relative flex flex-col justify-between h-full bg-emerald-50/30 dark:bg-emerald-900/10">
                    <div className="absolute top-2 right-2 opacity-10">
                        <FileCheck className="w-8 h-8 text-emerald-600" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelColor}`}>
                        Komitmen PO
                    </span>
                    <span className={`text-lg font-extrabold text-emerald-600`}>
                        {formatCurrency(data.komitmen_po_2025 * 1_000_000_000)}
                    </span>
                </div>

                {/* Item 3: % Komitmen (Rasio) - Ungu */}
                <div className="p-3 relative flex flex-col justify-between h-full">
                    <div className="absolute top-2 right-2 opacity-10">
                        <Percent className="w-8 h-8 text-indigo-500" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelColor}`}>
                        Persentase
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-lg font-extrabold text-indigo-500`}>
                            {data.persen_komitmen?.toFixed(2)}%
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

// --- Main Dashboard Component (Updated with Centralized Fetching) ---
const FinanceDashboard = () => {
    // --- State Management ---
    const [currentTime, setCurrentTime] = useState(new Date());
    const [theme, setTheme] = useState('light');

    // Separate States for data clarity
    const [financeData, setFinanceData] = useState(null);
    const [procurementData, setProcurementData] = useState(null);
    const [financeDepartmentData, setFinanceDepartmentData] = useState(null);
    const [procurementOnProcess, setProcurementOnProcess] = useState(null);
    const [procurementSummary, setProcurementSummary] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const currentYearValue = new Date().getFullYear();
    const availableYears = [currentYearValue, currentYearValue - 1];
    const [selectedYear, setSelectedYear] = useState(currentYearValue);

    // Fallback data imports
    const { total: budgetTotals } = departmentBudgetData;
    const { total: onProgressTotals } = staticProcurementData.pengadaan_status;

    const rawApiUrl = import.meta.env.VITE_API_URL;
    const API_URL = !rawApiUrl || /https?:\/\/(127\.0\.0\.1|localhost):5000\/api\/?$/i.test(rawApiUrl)
        ? "/api"
        : rawApiUrl.replace(/\/$/, "");

    const buildApiUrl = (path) => `${API_URL}${path}?year=${selectedYear}`;

    // --- 1. Centralized Data Fetching ---
    useEffect(() => {
        let isCancelled = false;

        const fetchData = async (showLoader = false) => {
            try {
                if (showLoader) {
                    setLoading(true);
                }

                const [
                    financeRes,
                    procRes
                ] = await Promise.all([
                    fetch(buildApiUrl('/finance-data')),
                    fetch(buildApiUrl('/procurement-data'))
                ]);

                if (!financeRes.ok) throw new Error('Gagal mengambil Data Finance');
                if (!procRes.ok) throw new Error('Gagal mengambil Data Procurement');

                const financeResult = await financeRes.json();
                const procResult = await procRes.json();

                if (isCancelled) {
                    return;
                }

                setFinanceData(financeResult);
                setProcurementData(procResult);
                setFinanceDepartmentData({
                    overall_departments:
                        financeResult?.grouped?.OVERALL?.length > 0
                            ? financeResult.grouped.OVERALL
                            : financeResult?.departments || [],
                    slicer: financeResult?.slicer,
                });
                setProcurementSummary(procResult?.dashboardData?.summary_box || {});
                setProcurementOnProcess(procResult?.procurementStatusData?.pengadaan_status?.divisi || []);
                setLastUpdated(new Date());
                setError(null);
            } catch (err) {
                console.error("Fetch error:", err);
                if (!isCancelled) {
                    setError(err.message);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchData(true);
        const intervalId = setInterval(() => fetchData(false), DASHBOARD_REFRESH_INTERVAL);
        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [selectedYear]);

    // --- Timer Jam ---
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleTheme = () => {
        setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
    };

    const isLight = theme === 'light';

    // --- Loading State ---
    if (loading) {
        return (
            <div className={`flex h-screen w-full items-center justify-center ${isLight ? 'bg-slate-100' : 'bg-slate-950'}`}>
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className={`h-10 w-10 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} />
                    <p className={isLight ? 'text-slate-600' : 'text-slate-400'}>Mengambil Data Real-time...</p>
                </div>
            </div>
        );
    }

    // --- Error State ---
    // Ensure financeData exists before rendering main components
    if (error || !financeData) {
        return <div className="flex h-screen items-center justify-center text-red-500">Error: {error || "Data tidak ditemukan"}</div>;
    }

    // --- Data Processing ---
    const {
        total_lrtj,
        category_totals,
    } = financeData;

    // Prepare Procurement Data for Props
    // Use optional chaining to handle cases where procurement fetch might fail but finance succeeded, or initial load issues
    const realtimeOnProgressTotals = procurementData?.procurementStatusData?.pengadaan_status?.total || {
        ongoing_request: 0,
        on_proses_pengadaan: 0,
        estimasi_serapan: 0
    };

    const realtimeProcurementStatus = procurementData?.procurementStatusData?.pengadaan_status || { total: {}, divisi: [] };

    // Mapping Data KPI
    const kpiProposal = category_totals?.OVERALL?.anggaran_proposal_total || 0;
    const DataRealisasi = total_lrtj?.realisasi_capex_total + total_lrtj?.opex_verifikasi_total + total_lrtj?.opex_ppa_spuk_kk_total || 0;
    const kpiRealokasi = total_lrtj?.anggaran_realokasi_2025_total || 0;

    const kpiRealisasi = DataRealisasi;
    // Prioritas: baca % dari TOTAL LRTJ (langsung dari Excel kolom BF), fallback ke category_totals
    const kpiPersenPenyerapan = total_lrtj?.penyerapan_persen || category_totals?.OVERALL?.penyerapan_persen || 0;
    const kpiSisaAnggaran = category_totals?.OVERALL?.sisa_anggaran_total || 0;

    const capexData = total_lrtj?.realisasi_capex_total || 0;
    const OpexVerif = total_lrtj?.opex_verifikasi_total || 0;
    const OpexPPA = total_lrtj?.opex_ppa_spuk_kk_total || 0;
    const PenyerapanTotal = category_totals?.SUBSIDI?.penyerapan_total || 0;

    const Subsidi = category_totals?.SUBSIDI?.sisa_anggaran_total || 0;
    const Busdev = category_totals?.BUSDEV?.sisa_anggaran_total || 0;
    const Corcost = category_totals?.CORPORATE_COST?.sisa_anggaran_total || 0;

    const PropsSubsidi = category_totals?.SUBSIDI?.anggaran_proposal_total || 0;
    const PropsBusdev = category_totals?.BUSDEV?.anggaran_proposal_total || 0;
    const PropsCorcost = category_totals?.CORPORATE_COST?.anggaran_proposal_total || 0;

    const PenyerapanSubsidi = category_totals?.SUBSIDI?.penyerapan_persen || 0;
    const PenyerapanBusdev = category_totals?.BUSDEV?.penyerapan_persen || 0;
    const PenyerapanCorcost = category_totals?.CORPORATE_COST?.penyerapan_persen || 0;

    // Breakdown Realokasi
    const RealokSubsidi = category_totals?.SUBSIDI?.anggaran_realokasi_2025_total || 0;
    const RealokBusdev = category_totals?.BUSDEV?.anggaran_realokasi_2025_total || 0;
    const RealokCorcost = category_totals?.CORPORATE_COST?.anggaran_realokasi_2025_total || 0;


    const topKpis = [
        { title: "Proposal", value: formatCurrency(kpiProposal), icon: Briefcase, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Realokasi", value: formatCurrency(kpiRealokasi), icon: Package, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Realisasi", value: formatCurrency(kpiRealisasi), icon: Wallet, color: 'text-slate-900' },
        {
            title: "% Penyerapan",
            value: `${Number(kpiPersenPenyerapan).toFixed(2)}%`,
            icon: Package,
            color: 'text-emerald-500'
        },
        { title: "Sisa Anggaran", value: formatCurrency(kpiSisaAnggaran), icon: Wallet, color: 'text-[#F6821F]' },

    ];

    const rightKPI = [
        { title: "Capex", value: formatCurrency(capexData), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Verifikasi", value: formatCurrency(OpexVerif), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "PPA/SPUK/KK", value: formatCurrency(OpexPPA), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
    ]

    const breakdownPenyerapan = [
        { title: "Subsidi", value: formatCurrency(Subsidi), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Busdev", value: formatCurrency(Busdev), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Corporate Cost", value: formatCurrency(Corcost), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
    ]

    const breakdownRealokasi = [
        { title: "Subsidi", value: formatCurrency(RealokSubsidi), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Busdev", value: formatCurrency(RealokBusdev), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Corporate Cost", value: formatCurrency(RealokCorcost), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
    ]

    const breakdownProposal = [
        { title: "Subsidi", value: formatCurrency(PropsSubsidi), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Busdev", value: formatCurrency(PropsBusdev), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
        { title: "Corporate Cost", value: formatCurrency(PropsCorcost), icon: Wallet, color: isLight ? 'text-slate-900' : 'text-white' },
    ]

    const breakdownPenyerapanValue = [
        {
            title: "Subsidi",
            value: Number(PenyerapanSubsidi).toFixed(2) + "%",
            icon: Wallet,
            color: isLight ? 'text-slate-900' : 'text-white'
        },
        {
            title: "Busdev",
            value: Number(PenyerapanBusdev).toFixed(2) + "%",
            icon: Wallet,
            color: isLight ? 'text-slate-900' : 'text-white'
        },
        {
            title: "Corporate Cost",
            value: Number(PenyerapanCorcost).toFixed(2) + "%",
            icon: Wallet,
            color: isLight ? 'text-slate-900' : 'text-white'
        },
    ];

    const { realokasi_2025: capexOpexData } = departmentBudgetData.total;

    const budgetTotalsForPieChart = {
        penyerapan: {
            total: kpiRealisasi,
            persentase: kpiPersenPenyerapan
        },
        sisa_anggaran: {
            total: kpiSisaAnggaran
        },
        realokasi_2025: {
            total: kpiRealokasi,
            capex: capexOpexData.capex,
            opex: capexOpexData.opex
        }
    };

    return (
        <>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap'); .font-jakarta-sans { font-family: 'Plus Jakarta Sans', sans-serif; }`}</style>
            <div className={`min-h-screen lg:h-screen lg:overflow-hidden p-3 flex flex-col font-jakarta-sans transition-colors duration-300 ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-950 text-slate-200'}`}>

                {/* Header */}
                <header className="mb-2 flex flex-col md:flex-row justify-between items-center p-3 rounded-lg bg-gradient-to-r from-[#D3242B] to-[#F6821F] flex-shrink-0 shadow-lg">
                    <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-2 md:gap-4">
                        <img src="https://e-ptw.lrtjakarta.co.id/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo-lrtj-white.847caf54.png&w=640&q=75" alt="LRT Jakarta Logo" className="h-10" />
                        <div>
                            <h1 className="text-xl font-bold tracking-wide text-white">Dashboard Penyerapan Anggaran</h1>
                            <p className="text-xs font-semibold text-white/80">Real-Time Dashboard | LRT Jakarta</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 md:mt-0">
                        <div className="flex flex-col items-end">
                            <label htmlFor="dashboard-year" className="text-[10px] font-bold uppercase tracking-wide text-white/80">
                                Tahun
                            </label>
                            <select
                                id="dashboard-year"
                                value={selectedYear}
                                onChange={(event) => setSelectedYear(Number(event.target.value))}
                                className="mt-1 rounded-md border border-white/20 bg-white/15 px-3 py-1 text-sm font-bold text-white outline-none transition-colors hover:bg-white/20"
                            >
                                {availableYears.map((year) => (
                                    <option key={year} value={year} className="text-slate-900">
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-white">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="text-white/80 text-xs">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                            <div className="text-[10px] text-white/60 mt-1 font-mono">
                                Last update: {lastUpdated ? lastUpdated.toLocaleTimeString('id-ID') : '...'}
                            </div>
                        </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">{isLight ? <Moon size={20} /> : <Sun size={20} />}</button>
                    </div>
                </header>

                {/* Top KPI Bar */}
                <section className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1 mb-2 flex-shrink-0 rounded-lg p-1 transition-colors ${isLight ? "bg-white border border-slate-200 shadow-sm" : "bg-slate-900 border border-slate-800"}`}>
                    {topKpis.map((kpi, index) => {
                        const isRealisasi = kpi.title.toLowerCase().includes("realisasi");
                        const isSisaAnggaran = kpi.title.toLowerCase().includes("sisa anggaran");
                        const isRealokasi = kpi.title.toLowerCase().includes("realokasi");
                        const isProposal = kpi.title.toLowerCase().includes("proposal");
                        const isPenyerapan = kpi.title.toLowerCase().includes("% penyerapan");

                        return (
                            <div
                                key={kpi.title}
                                className={`relative rounded-lg flex flex-col justify-center p-2 h-full ${index > 0 ? "border-l" : ""
                                    } transition-all duration-200 ${isLight
                                        ? "hover:bg-slate-50 border-slate-200"
                                        : "hover:bg-slate-800 border-slate-700"
                                    }`}
                                style={{ borderColor: isLight ? "#e2e8f0" : "#334155" }}
                            >
                                {/* Card Normal */}
                                {isPenyerapan && (
                                    <div className={`flex items-center justify p-2 rounded-lg h-full ${isLight}`}>
                                        {/* Kiri: Nilai Realisasi */}
                                        <div className="flex flex-col items-center text-center justify-center w-1/2">
                                            <div className={`text-[11px] font-bold uppercase ml-2 mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                {kpi.title}
                                            </div>
                                            <div className={`text-xl font-extrabold flex items-center justify-center gap-1 ${kpi.color} ${isLight ? "" : "text-white"}`}>
                                                <kpi.icon className="h-5 w-5" />
                                                {kpi.value}
                                            </div>
                                        </div>

                                        {/* Kanan: Data Turunan */}
                                        <div className="flex flex-col gap-1 w-1/2 justify-center">
                                            {breakdownPenyerapanValue.map((sub) => (
                                                <div key={sub.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-left p-0 rounded-md hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all">
                                                    <sub.icon className="h-3 w-3 flex-shrink-0" />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                        {sub.title}
                                                    </span>
                                                    <span className={`text-[11px] font-bold ${sub.color}`}>
                                                        {sub.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Card Proposal */}
                                {isProposal && (
                                    <div className={`flex items-center justify p-2 rounded-lg h-full ${isLight}`}>
                                        {/* Kiri: Nilai Realisasi */}
                                        <div className="flex flex-col items-center text-center justify-center w-1/2">
                                            <div className={`text-[11px] font-bold uppercase ml-2 mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                {kpi.title}
                                            </div>
                                            <div className={`text-xl font-extrabold flex items-center justify-center gap-1 ${kpi.color} ${isLight ? "" : "text-white"}`}>
                                                <kpi.icon className="h-5 w-5" />
                                                {kpi.value}
                                            </div>
                                        </div>

                                        {/* Kanan: Data Turunan */}
                                        <div className="flex flex-col gap-1 w-1/2 justify-center">
                                            {breakdownProposal.map((sub) => (
                                                <div key={sub.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-left p-0 rounded-md hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all">
                                                    <sub.icon className="h-3 w-3 flex-shrink-0" />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                        {sub.title}
                                                    </span>
                                                    <span className={`text-[11px] font-bold ${sub.color}`}>
                                                        {sub.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Card Realokasi */}
                                {isRealokasi && (
                                    <div className={`flex items-center justify p-2 rounded-lg h-full ${isLight}`}>
                                        <div className="flex flex-col items-center text-center justify-center w-1/2">
                                            <div className={`text-[11px] font-bold uppercase ml-2 mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                {kpi.title}
                                            </div>
                                            <div className={`text-xl font-extrabold flex items-center justify-center gap-1 ${kpi.color} ${isLight ? "" : "text-white"}`}>
                                                <kpi.icon className="h-5 w-5" />
                                                {kpi.value}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 w-1/2 justify-center">
                                            {breakdownRealokasi.map((sub) => (
                                                <div key={sub.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-left p-0 rounded-md hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all">
                                                    <sub.icon className="h-3 w-3 flex-shrink-0" />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                        {sub.title}
                                                    </span>
                                                    <span className={`text-[11px] font-bold ${sub.color}`}>
                                                        {sub.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Card Sisa Anggaran */}
                                {isSisaAnggaran && (
                                    <div className={`flex items-center justify p-2 rounded-lg h-full ${isLight}`}>
                                        <div className="flex flex-col items-center text-center justify-center w-1/2">
                                            <div className={`text-[11px] font-bold uppercase ml-2 mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                {kpi.title}
                                            </div>
                                            <div className={`text-xl font-extrabold flex items-center justify-center gap-1 ${kpi.color} ${isLight ? "" : "text-white"}`}>
                                                <kpi.icon className="h-5 w-5" />
                                                {kpi.value}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 w-1/2 justify-center">
                                            {breakdownPenyerapan.map((sub) => (
                                                <div key={sub.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-left p-0 rounded-md hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all">
                                                    <sub.icon className="h-3 w-3 flex-shrink-0" />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                        {sub.title}
                                                    </span>
                                                    <span className={`text-[11px] font-bold ${sub.color}`}>
                                                        {sub.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Card Realisasi */}
                                {isRealisasi && (
                                    <div className={`flex items-center justify p-2 rounded-lg h-full ${isLight}`}>
                                        <div className="flex flex-col items-center text-center justify-center w-1/2">
                                            <div className={`text-[11px] font-bold uppercase ml-2 mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                {kpi.title}
                                            </div>
                                            <div className={`text-xl font-extrabold flex items-center justify-center gap-1 ${kpi.color} ${isLight ? "" : "text-white"}`}>
                                                <kpi.icon className="h-5 w-5" />
                                                {kpi.value}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 w-1/2 justify-center">
                                            {rightKPI.map((sub) => (
                                                <div key={sub.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-left p-0 rounded-md hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all">
                                                    <sub.icon className="h-3 w-3 flex-shrink-0" />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                        {sub.title}
                                                    </span>
                                                    <span className={`text-[11px] font-bold ${sub.color}`}>
                                                        {sub.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </section>

                {/* Main Content Area */}
                <main className="flex-1 min-h-0 flex flex-col gap-2">
                    {/* --- LAYOUT BARU --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 min-h-0">

                        {/* Left Column (lg:col-span-3) - (Kolom Status) */}
                        <div className="lg:col-span-3 flex flex-col gap-2 min-h-0">

                            <BudgetSummaryCharts
                                isLight={isLight}
                                budgetTotals={budgetTotalsForPieChart}
                                financeData={financeData}  // <--- JANGAN LUPA TAMBAHKAN INI
                            />

                            {/* UPDATED: Pass realtimeOnProgressTotals as data prop */}
                            <OnProgressKpis
                                isLight={isLight}
                                data={realtimeOnProgressTotals}
                            />

                            <SavingsKpis
                                isLight={isLight}
                                data={procurementSummary}
                            />

                            <OnProgressPO isLight={isLight} data={procurementSummary} />

                            <div className="flex-1 min-h-[300px] lg:min-h-0">
                                {/* UPDATED: Pass realtimeProcurementStatus as data prop */}
                                {/* <ProcurementStatusChart isLight={isLight} data={realtimeProcurementStatus} /> */}
                            </div>
                        </div>

                        <div className="lg:col-span-9 flex flex-col gap-2 min-h-0">
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 min-h-0">
                                <div className="h-full min-h-[300px] lg:min-h-0 lg:col-span-12">
                                    {/* UPDATED: Pass procurementData as data prop */}
                                    <InteractiveProcurementChart isLight={isLight} data={procurementData} />
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 min-h-0">
                                <div className="h-full min-h-[300px] lg:min-h-0 lg:col-span-7">
                                    <DepartmentBudgetPerformanceChart
                                        isLight={theme === 'light'}
                                        data={financeDepartmentData}
                                    />
                                </div>
                                <div className="h-full min-h-[300px] lg:min-h-0 lg:col-span-5">
                                    <ProcurementStatusChart isLight={isLight} data={realtimeProcurementStatus} />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
};

export default FinanceDashboard;
