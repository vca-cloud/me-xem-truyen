import "server-only";

import { revenueImportTemplates, type RevenueImportType } from "@/lib/analytics-shared";
import { parseCsvRecords } from "@/lib/story-import";

const statusMap: Record<string, "pending" | "approved" | "cancelled"> = {
  pending: "pending", "đang chờ": "pending", "chờ xử lý": "pending", "đang xử lý": "pending", "chờ duyệt": "pending",
  approved: "approved", completed: "approved", "hoàn thành": "approved", "đã hoàn thành": "approved", "đã duyệt": "approved",
  cancelled: "cancelled", canceled: "cancelled", "đã hủy": "cancelled", "hủy": "cancelled", "không hợp lệ": "cancelled",
};

function parseMoney(value: string) {
  const cleaned = value.replace(/[\s₫đ]|VND/gi, "");
  if (!cleaned) return 0;
  if (/^-?\d+([.,]\d{1,2})?$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  const digits = cleaned.replace(/[^\d-]/g, "");
  return digits ? Number(digits) : Number.NaN;
}

function parseCount(value: string) {
  const digits = value.replace(/[\s.,]/g, "");
  return /^\d*$/.test(digits) ? Number(digits || 0) : Number.NaN;
}

// Accepts YYYY-MM-DD[ HH:MM[:SS]] or DD/MM/YYYY[ HH:MM[:SS]] in Vietnam time.
function parseVietnamDateTime(value: string) {
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  let parts: string[] | null = match ? [match[1], match[2], match[3], match[4], match[5], match[6]] : null;
  if (!parts) {
    match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) parts = [match[3], match[2].padStart(2, "0"), match[1].padStart(2, "0"), match[4]?.padStart(2, "0"), match[5], match[6]];
  }
  if (!parts) return null;
  const [year, month, day, hour = "00", minute = "00", second = "00"] = parts;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`);
  return Number.isNaN(date.getTime()) ? null : { iso: date.toISOString(), day: `${year}-${month}-${day}` };
}

export type ShopeeConversionRow = { order_id: string; sub_id: string | null; order_amount: number; commission: number; status: "pending" | "approved" | "cancelled"; ordered_at: string };
export type AdsenseDailyRow = { date: string; ad_unit: string; page_views: number; impressions: number; clicks: number; earnings: number };

export function parseRevenueCsv(type: "shopee", input: string): { rows: ShopeeConversionRow[]; errors: string[] };
export function parseRevenueCsv(type: "adsense", input: string): { rows: AdsenseDailyRow[]; errors: string[] };
export function parseRevenueCsv(type: RevenueImportType, input: string): { rows: (ShopeeConversionRow | AdsenseDailyRow)[]; errors: string[] } {
  const errors: string[] = [];
  let records: string[][];
  try {
    records = parseCsvRecords(input.replace(/^﻿/, ""));
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : "File CSV không hợp lệ."] };
  }
  const [header = [], ...body] = records;
  const columns = header.map((item) => item.trim().toLowerCase());
  const required = revenueImportTemplates[type].headers;
  const missing = required.filter((name) => !columns.includes(name) && !(type === "shopee" && name === "sub_id"));
  if (missing.length) return { rows: [], errors: [`Thiếu cột: ${missing.join(", ")}.`] };
  const get = (record: string[], name: string) => (record[columns.indexOf(name)] ?? "").trim();

  const rows: (ShopeeConversionRow | AdsenseDailyRow)[] = [];
  body.forEach((record, index) => {
    const line = index + 2;
    if (type === "shopee") {
      const orderId = get(record, "order_id");
      const amount = parseMoney(get(record, "order_amount"));
      const commission = parseMoney(get(record, "commission"));
      const status = statusMap[get(record, "status").toLowerCase()];
      const orderedAt = parseVietnamDateTime(get(record, "ordered_at"));
      if (!orderId) errors.push(`Dòng ${line}: thiếu order_id.`);
      else if (Number.isNaN(amount) || Number.isNaN(commission)) errors.push(`Dòng ${line}: số tiền không hợp lệ.`);
      else if (!status) errors.push(`Dòng ${line}: status phải là pending, approved hoặc cancelled.`);
      else if (!orderedAt) errors.push(`Dòng ${line}: ordered_at phải có dạng YYYY-MM-DD HH:MM hoặc DD/MM/YYYY HH:MM.`);
      else rows.push({ order_id: orderId, sub_id: get(record, "sub_id") || null, order_amount: amount, commission, status, ordered_at: orderedAt.iso });
    } else {
      const date = parseVietnamDateTime(get(record, "date"));
      const values = { page_views: parseCount(get(record, "page_views")), impressions: parseCount(get(record, "impressions")), clicks: parseCount(get(record, "clicks")) };
      const earnings = parseMoney(get(record, "earnings"));
      if (!date) errors.push(`Dòng ${line}: date phải có dạng YYYY-MM-DD hoặc DD/MM/YYYY.`);
      else if (Object.values(values).some(Number.isNaN) || Number.isNaN(earnings)) errors.push(`Dòng ${line}: số liệu không hợp lệ.`);
      else rows.push({ date: date.day, ad_unit: get(record, "ad_unit") || "Tất cả", ...values, earnings });
    }
  });

  if (type === "shopee") {
    const ids = rows.map((row) => (row as ShopeeConversionRow).order_id);
    if (new Set(ids).size !== ids.length) errors.push("File có order_id bị trùng.");
  } else {
    const keys = rows.map((row) => `${(row as AdsenseDailyRow).date}|${(row as AdsenseDailyRow).ad_unit}`);
    if (new Set(keys).size !== keys.length) errors.push("File có dòng trùng ngày và ad_unit.");
  }
  return { rows, errors: errors.slice(0, 20) };
}
