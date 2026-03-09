import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());

// ==========================================
// 1. LOGIKA GRAPH API & AUTH (TIDAK BERUBAH)
// ==========================================
async function getAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", process.env.AZURE_CLIENT_ID);
  params.append("client_secret", process.env.AZURE_CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Gagal dapat token');
  return data.access_token;
}

async function getExcelValues() {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0/drives/${process.env.SHAREPOINT_DRIVE_ID}/items/${process.env.SHAREPOINT_ITEM_ID}/workbook/worksheets('${process.env.SHAREPOINT_SHEET_NAME}')/usedRange(valuesOnly=true)`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  return data.values;
}

async function getProcurementValues() {
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0/drives/${process.env.SHAREPOINT_DRIVE_ID2}/items/${process.env.SHAREPOINT_ITEM_ID2}/workbook/worksheets('${process.env.SHAREPOINT_SHEET_NAME2}')/usedRange(valuesOnly=true)`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  return data.values;
}

// ==========================================
// 2. HELPER FINANCE
// ==========================================
function mapRowToData(row, isTotalRow = false) {
  // Index < 35 (Kolom A - AI) tidak berubah
  const anggaranRealokasiTotal = Number(row[10]) || 0; 
  
  // UPDATE: Penyerapan Total (Index lama 55 -> geser jadi 56)
  // Kolom BD (55) geser ke BE (56)
  const penyerapanTotal = Number(row[56]) || 0;        

  let calculatedPersen = 0;
  if (anggaranRealokasiTotal > 0) {
      calculatedPersen = (penyerapanTotal / anggaranRealokasiTotal) * 100;
  }

  return {
    kode: row[1],
    div: row[2],
    direktorat: row[3],
    departemen: row[4],
    anggaran_proposal_capex: Number(row[5]) || 0,
    anggaran_proposal_opex: Number(row[6]) || 0,
    anggaran_proposal_total: Number(row[7]) || 0,
    anggaran_realokasi_2025_capex: Number(row[8]) || 0,
    anggaran_realokasi_2025_opex: Number(row[9]) || 0,
    anggaran_realokasi_2025_total: Number(row[10]) || 0,
    realisasi_capex_total: Number(row[23]) || 0,
    
    // UPDATE: Opex Verifikasi
    opex_verifikasi_total: Number(row[37]) || 0, 

    // UPDATE: Opex PPA SPUK KK
    opex_ppa_spuk_kk_total: Number(row[50]) || 0, 

    // UPDATE: Proforma Total
    proforma_total: Number(row[53]) || 0, 

    // UPDATE: Penyerapan Total (Sama dengan variabel di atas)
    penyerapan_total: Number(row[56]) || 0, 

    penyerapan_persen: calculatedPersen,

    // UPDATE: Sisa Anggaran Total
    sisa_anggaran_total: Number(row[60]) || 0 
  };
}

function addToTotal(target, source) {
  target.anggaran_proposal_capex += source.anggaran_proposal_capex;
  target.anggaran_proposal_opex += source.anggaran_proposal_opex;
  target.anggaran_proposal_total += source.anggaran_proposal_total;
  target.anggaran_realokasi_2025_capex += source.anggaran_realokasi_2025_capex;
  target.anggaran_realokasi_2025_opex += source.anggaran_realokasi_2025_opex;
  target.anggaran_realokasi_2025_total += source.anggaran_realokasi_2025_total;
  target.realisasi_capex_total += source.realisasi_capex_total;
  target.opex_verifikasi_total += source.opex_verifikasi_total;
  target.opex_ppa_spuk_kk_total += source.opex_ppa_spuk_kk_total;
  target.proforma_total += source.proforma_total;
  target.penyerapan_total += source.penyerapan_total;
  target.sisa_anggaran_total += source.sisa_anggaran_total;
}

function createZeroTotal() {
  return {
    anggaran_proposal_capex: 0, anggaran_proposal_opex: 0, anggaran_proposal_total: 0,
    anggaran_realokasi_2025_capex: 0, anggaran_realokasi_2025_opex: 0, anggaran_realokasi_2025_total: 0,
    realisasi_capex_total: 0, opex_verifikasi_total: 0, opex_ppa_spuk_kk_total: 0,
    proforma_total: 0, penyerapan_total: 0, sisa_anggaran_total: 0
  };
}

function transformExcelToDashboardData(rows) {
  const groupedData = { SUBSIDI: [], BUSDEV: [], CORPORATE_COST: [], OVERALL: [] };
  const categoryTotals = { SUBSIDI: createZeroTotal(), BUSDEV: createZeroTotal(), CORPORATE_COST: createZeroTotal(), OVERALL: createZeroTotal() };

  let totalLRTJ_fromExcel = null;
  const departments = [];
  let currentCategory = "SUBSIDI"; 

  rows.forEach((row) => {
    const col1 = String(row[1] || "").trim();
    if (col1 === "SUBSIDI") { currentCategory = "SUBSIDI"; return; }
    else if (col1 === "BUSDEV") { currentCategory = "BUSDEV"; return; }
    else if (col1 === "CORPORATE COST") { currentCategory = "CORPORATE_COST"; return; }
    else if (col1 === "OVERALL") { currentCategory = "OVERALL"; return; }

    if (/^\d{2}$/.test(col1)) {
      const deptData = mapRowToData(row, false);
      departments.push({ ...deptData, category: currentCategory });
      if (groupedData[currentCategory]) {
        groupedData[currentCategory].push(deptData);
        addToTotal(categoryTotals[currentCategory], deptData);
      }
    } else if (col1 === "TOTAL LRTJ") {
      totalLRTJ_fromExcel = mapRowToData(row, true); 
    }
  });

  Object.keys(categoryTotals).forEach(key => {
    const t = categoryTotals[key];
    t.penyerapan_persen = t.anggaran_realokasi_2025_total > 0 ? (t.penyerapan_total / t.anggaran_realokasi_2025_total) * 100 : 0;
  });

  const calculatedGrandTotal = createZeroTotal();
  Object.values(categoryTotals).forEach(cat => addToTotal(calculatedGrandTotal, cat));
  calculatedGrandTotal.penyerapan_persen = calculatedGrandTotal.anggaran_realokasi_2025_total > 0
      ? (calculatedGrandTotal.penyerapan_total / calculatedGrandTotal.anggaran_realokasi_2025_total) * 100 : 0;

  const finalTotal = totalLRTJ_fromExcel || calculatedGrandTotal;

  return {
    total_lrtj: finalTotal,
    category_totals: categoryTotals,
    grouped: groupedData,
    departments: departments,
    departmentBudgetData: {
      total: {
        realokasi_2025: { total: finalTotal.anggaran_realokasi_2025_total, capex: finalTotal.anggaran_realokasi_2025_capex, opex: finalTotal.anggaran_realokasi_2025_opex },
        penyerapan: { total: finalTotal.penyerapan_total, persentase: finalTotal.penyerapan_persen },
        sisa_anggaran: { total: finalTotal.sisa_anggaran_total }
      },
      departments: departments
    },
    // Placeholder legacy
    dashboardData: { data_per_bulan: [] }, divisionalProcurementData: { data: [] }, procurementStatusData: { pengadaan_status: { divisi: [], total: {} } }, savingsData: { Yearly_Total: {}, data: [] },
  };
}

// ==========================================
// 3. LOGIKA PROCUREMENT (DIPERBARUI LOGIKANYA SAJA)
// ==========================================
// Note: Logika ini diperbarui agar bisa mendeteksi Header "Ongoing REQUEST" dan "Summary"
// Output struktur datanya tetap SAMA dengan yang lama, jadi endpoint lama aman.

function transformProcurementData(rows) {
  const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

  const dashboardDataPerBulan = [];
  const divisionalDataList = [];
  const onProcessDivisiList = [];
  
  let summaryData = {
    terserap_2025: 0, 
    komitmen_po_2025: 0, 
    total_hps_2025: 0,
    serapan_onproses_2025: 0, 
    total_sementara: 0,
    persen_terserap: 0, 
    persen_komitmen: 0, 
    persen_selisih_hps: 0, 
    persen_total_serapan: 0
  };

  let onProcessTotal = { jumlah_pr: 0, total_pr_value: 0, estimasi_serapan: 0 };
  let grandTotalHPS = 0, grandTotalKomitmen = 0, grandTotalPR = 0;
  let isGrandTotalFound = false;
  let isReadingOnProcessTable = false; 

  // --- HELPER: Cari Nilai di Kanan Label (Melompati kolom kosong) ---
  const findValueNextToLabel = (row, startIdx) => {
    // Cek sampai 3 kolom ke kanan (untuk jaga-jaga ada kolom kosong/merged cells)
    for (let i = 1; i <= 3; i++) {
        const val = row[startIdx + i];
        // Jika val adalah angka dan bukan string kosong
        if (val !== "" && val !== null && !isNaN(Number(val))) {
            return Number(val);
        }
    }
    return 0;
  };

  // --- HELPER: Normalisasi Teks untuk Pencarian (Hapus spasi & lowercase) ---
  const cleanStr = (str) => String(str || "").toLowerCase().replace(/\s+/g, "");

  rows.forEach((row, rowIndex) => {
    const colA = String(row[0] || "").trim();
    const colB = String(row[1] || "").trim();
    const colC = String(row[2] || "").trim();
    const colD = String(row[3] || "").trim();
    const colE = String(row[4] || "").trim();

    // 1. DETEKSI HEADER "ON PROCESS"
    if (colD === "Ongoing REQUEST" && colE.includes("OnProses Pengadaan")) {
        isReadingOnProcessTable = true;
        return; 
    }

    // 2. LOGIKA TABEL "ON PROCESS"
    if (isReadingOnProcessTable) {
        if (colB === "TOTAL") {
             onProcessTotal.jumlah_pr = Number(row[3]) || 0;
             onProcessTotal.total_pr_value = Number(row[4]) || 0;
             // Coba cari estimasi serapan di kolom 4, 5, atau 6 (karena kadang geser)
             onProcessTotal.estimasi_serapan = Number(row[4]) || Number(row[5]) || 0; 
             isReadingOnProcessTable = false; 
        } else if (colC.length > 0 && colC !== "KODE DIVISI") {
            onProcessDivisiList.push({
                divisi: colB,
                kode: colC,
                ongoing_request: Number(row[3]) || 0,
                on_proses_pengadaan: Number(row[4]) || 0
            });
        }
        return; 
    }

    // 3. LOGIKA SUMMARY BOX (SMART SEARCH)
    const nextRow = rows[rowIndex + 1] || [];

    const findValueHorizontal = (row, startIdx) => {
    // Loop sampai 5 kolom ke kanan (antisipasi Merge Cell)
    for (let i = 1; i <= 5; i++) {
        let val = row[startIdx + i];

        // Cek jika value ada isinya
        if (val !== undefined && val !== null && val !== "") {
            
            // Konversi ke string dulu
            let strVal = String(val);

            // Hapus "Rp", spasi, dan karakter huruf lain. Sisakan angka, titik, koma, minus
            // Contoh: "Rp35.97" -> "35.97"
            let cleanVal = strVal.replace(/[^0-9.,-]/g, "");

            // Jika format Indonesia (35,97), ubah koma jadi titik agar terbaca Javascript
            if (cleanVal.includes(',') && !cleanVal.includes('.')) {
                cleanVal = cleanVal.replace(',', '.');
            }

            const finalNum = Number(cleanVal);

            // Jika hasil konversi adalah angka valid, kembalikan
            if (!isNaN(finalNum)) {
                return finalNum;
            }
        }
    }
    return 0;
  };

    row.forEach((cellRaw, index) => {
        const text = cleanStr(cellRaw);

        // LOGIKA VERTIKAL (Header di Baris Ini, Value di Baris Bawah)
        
        // "Terserap di 2025" -> Value di bawahnya
        if (text.includes("terserapdi2025")) {
            summaryData.terserap_2025 = Number(nextRow[index]) || 0;
        } 

        else if (text.includes("lintastahun") && text.includes("2026")) {
            summaryData.lintastahun2026 = Number(nextRow[index]) || 0;
        }

        else if (text.includes("recurring") && text.includes("2026")) {
            summaryData.recurring2026 = Number(nextRow[index]) || 0;
        }


        // "Komitment PO - 2025" -> Value di bawahnya
        else if (text.includes("komitmen") && text.includes("po") && text.includes("2025")) {
            summaryData.komitmen_po_2025 = Number(nextRow[index]) || 0;
        }
        // "Total HPS - 2025" -> Value di bawahnya (Hindari tertukar dengan Persentase Selisih)
        else if (text.includes("totalhps") && text.includes("2025") && !text.includes("selisih")) {
            summaryData.total_hps_2025 = Number(nextRow[index]) || 0;
        }
        // "Total Sementara" -> Value di bawahnya
        else if (text === "totalsementara") {
            summaryData.total_sementara = Number(row[index - 1]) || 0;
        }
        // "Serapan Onproses-2025" -> Value di bawahnya
        // Note: Berdasarkan gambar, ini juga vertikal di bawah label kuning
        else if (text.includes("serapanonproses") && text.includes("2025")) {
            summaryData.serapan_onproses_2025 = Number(row[index - 1]) || 0;
        }

        // Carry Over
        else if (text.includes("carryover") && text.includes("2024")) {
            summaryData.carry_over = Number(row[index + 2]) || 0;
        }

        // Recurring
        else if (text.includes("recurring") && text.includes("2024")) {
            summaryData.recurring = Number(row[index + 2]) || 0;
        }

        // estimasi serapan 2025
        else if (text.includes("totalestimasiserapan") && text.includes("2025")) {
            summaryData.estimasi_serapan_2025 = Number(row[index + 2]) || 0;
        }

        else if (text.includes("totalpersentaseserapan")) {
            summaryData.total_persentase_serapan = Number(row[index - 1]) || 0;
        }

        // LOGIKA HORIZONTAL (Kasus Khusus)
        // Jika ada label "On-proses" yang berdiri sendiri dan valuenya disampingnya (seperti Rp35.97 di gambar)
        else if (text.includes("onproses")) {
             const val = findValueHorizontal(row, index);
             // Pastikan nama key sesuai dengan inisialisasi di awal (serapan_onproses_2025)
             if (val > 0) {
                summaryData.onproses = val; 
             }
        }
    });

    // 4. LOGIKA GRAFIK BULANAN & GRAND TOTAL
    if (colB === "Grand Total") {
        isGrandTotalFound = true;
        monthShort.forEach((bulan, i) => {
            const baseIndex = 4 + (i * 3); 
            const hps = Number(row[baseIndex]) || 0;
            const po = Number(row[baseIndex + 1]) || 0;
            const pr = Number(row[baseIndex + 2]) || 0;
            dashboardDataPerBulan.push({ bulan, HPS: hps, Komitmen_PO: po, PR: pr });
            grandTotalHPS += hps; grandTotalKomitmen += po; grandTotalPR += pr;
        });
    } 
    else if (colA === '#' && colB.includes('Total')) {
        const cleanDivName = colB.replace(/ Total$/i, '').trim();
        const monthlyDivData = [];
        monthNames.forEach((bulanFull, i) => {
            const baseIndex = 4 + (i * 3); 
            monthlyDivData.push({
                nama: bulanFull,
                hps: Number(row[baseIndex]) || 0,
                komitmen_po: Number(row[baseIndex + 1]) || 0,
                pr: Number(row[baseIndex + 2]) || 0
            });
        });
        divisionalDataList.push({ divisi: cleanDivName, kode_dept: "Total", bulan: monthlyDivData });
    }
  });

  const base = summaryData.komitmen_po_2025 > 0 ? summaryData.komitmen_po_2025 : 1;

  // Persentase berbasis komitmen
  summaryData.persentase = {
      lintas_tahun_2026: Number(((summaryData.lintastahun2026 / base) * 100).toFixed(2)),
      recurring_2026: Number(((summaryData.recurring2026 / base) * 100).toFixed(2)),
      terserap_2025: Number(((summaryData.terserap_2025 / base) * 100).toFixed(2)),
  };

  // --- LOGIKA TAMBAHAN UNTUK TOTAL HPS (Jika butuh) ---
  if (summaryData.total_hps_2025 > 0) {
      summaryData.persen_komitmen = Number(((summaryData.komitmen_po_2025 / summaryData.total_hps_2025) * 100).toFixed(2));
      summaryData.persen_selisih_hps = Number((100 - summaryData.persen_komitmen).toFixed(2));
      summaryData.persen_total_serapan = Number(((summaryData.total_sementara / summaryData.total_hps_2025) * 100).toFixed(2));
  }

  // --- HITUNG PERSENTASE SUMMARY (Otomatis) ---
  if (summaryData.komitmen_po_2025 > 0) {
      summaryData.persen_terserap = (summaryData.terserap_2025 / summaryData.komitmen_po_2025) * 100;
  }
  if (summaryData.total_hps_2025 > 0) {
      summaryData.persen_komitmen = (summaryData.komitmen_po_2025 / summaryData.total_hps_2025) * 100;
      summaryData.persen_selisih_hps = 100 - summaryData.persen_komitmen;
      summaryData.persen_total_serapan = (summaryData.total_sementara / summaryData.total_hps_2025) * 100;
  }

  // Fallback
  if (!isGrandTotalFound) {
      monthShort.forEach(b => dashboardDataPerBulan.push({ bulan: b, HPS: 0, Komitmen_PO: 0, PR: 0 }));
  }

  return {
    dashboardData: {
      data_per_bulan: dashboardDataPerBulan,
      total: { HPS: grandTotalHPS, Komitmen_PO: grandTotalKomitmen, Total_PR: grandTotalPR },
      summary_box: summaryData 
    },
    divisionalProcurementData: { data: divisionalDataList },
    procurementStatusData: {
        pengadaan_status: {
            total: {
                ongoing_request: onProcessTotal.jumlah_pr,         
                on_proses_pengadaan: onProcessTotal.total_pr_value,
                estimasi_serapan: onProcessTotal.estimasi_serapan   
            },
            divisi: onProcessDivisiList
        }
    }
  };
}


// ==========================================
// 4. API ENDPOINTS
// ==========================================

// --- ENDPOINT LAMA (JANGAN DIUBAH) ---
app.get('/api/finance-data', async (req, res) => {
  try {
    const rawData = await getExcelValues();
    const cleanData = transformExcelToDashboardData(rawData);
    res.json(cleanData);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finance-data-department', async (req, res) => {
  try {
    const rawData = await getExcelValues();
    const data = transformExcelToDashboardData(rawData);
    res.json({ overall_departments: data.grouped.OVERALL });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/procurement-data', async (req, res) => {
  try {
    const rawData = await getProcurementValues();
    // Menggunakan logika baru, tapi return JSON full seperti sedia kala
    const cleanData = transformProcurementData(rawData); 
    res.json({
        dashboardData: cleanData.dashboardData,
        divisionalProcurementData: cleanData.divisionalProcurementData,
        procurementStatusData: cleanData.procurementStatusData
    });
  } catch (error) {
    console.error("Error Procurement:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- ENDPOINT BARU (TAMBAHAN) ---

// 1. Endpoint Khusus Summary (Kotak Kanan)
app.get('/api/procurement/summary', async (req, res) => {
  try {
    const rawData = await getProcurementValues();
    const cleanData = transformProcurementData(rawData);
    // Hanya ambil bagian summary_box
    res.json(cleanData.dashboardData.summary_box);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Endpoint Khusus On Process (Tabel Status)
app.get('/api/procurement/on-process', async (req, res) => {
  try {
    const rawData = await getProcurementValues();
    const cleanData = transformProcurementData(rawData);
    // Hanya ambil bagian status pengadaan
    res.json(cleanData.procurementStatusData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- DEBUG ENDPOINT (HAPUS SETELAH SELESAI DEBUG) ---
app.get('/api/debug-columns', async (req, res) => {
  try {
    const rawData = await getExcelValues();
    
    // Cari row yang mengandung category markers dan data
    const debugInfo = {
      total_rows: rawData.length,
      total_cols_row0: rawData[0]?.length,
      rows_analysis: []
    };

    rawData.forEach((row, idx) => {
      const col0 = String(row[0] || "").trim();
      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();
      const col3 = String(row[3] || "").trim();
      const col4 = String(row[4] || "").trim();
      
      // Log category markers, 2-digit codes, TOTAL LRTJ, and header-like rows
      const isCategory = ["SUBSIDI", "BUSDEV", "CORPORATE COST", "OVERALL"].includes(col1);
      const isCategoryCol0 = ["SUBSIDI", "BUSDEV", "CORPORATE COST", "OVERALL"].includes(col0);
      const isDeptCode = /^\d{2}$/.test(col1);
      const isTotalLRTJ = col1 === "TOTAL LRTJ";
      const hasPenyerapanKeyword = row.some(cell => String(cell || "").toUpperCase().includes("PENYERAPAN"));
      
      if (isCategory || isCategoryCol0 || isDeptCode || isTotalLRTJ || hasPenyerapanKeyword || idx < 10) {
        debugInfo.rows_analysis.push({
          row_index: idx,
          col0, col1, col2, col3, col4,
          is_category_col1: isCategory,
          is_category_col0: isCategoryCol0,
          is_dept_code: isDeptCode,
          is_total_lrtj: isTotalLRTJ,
          has_penyerapan_keyword: hasPenyerapanKeyword,
          // Kolom kunci
          "row[10]_anggaran_realokasi_total": row[10],
          "row[23]_realisasi_capex": row[23],
          "row[37]_opex_verifikasi": row[37],
          "row[50]_opex_ppa": row[50],
          "row[53]_proforma": row[53],
          "row[54]_BC": row[54],
          "row[55]_BD": row[55],
          "row[56]_BE_penyerapan_total": row[56],
          "row[57]_BF": row[57],
          "row[58]_BG": row[58],
          "row[59]_BH": row[59],
          "row[60]_BI_sisa_anggaran": row[60],
          "row[61]_BJ": row[61],
        });
      }
    });

    res.json(debugInfo);
  } catch (error) {
    console.error("Debug Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});