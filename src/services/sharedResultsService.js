import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sharedStorageEnabled = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = sharedStorageEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

function sanitizeRevealRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    ...record,
    sessionId: typeof record.sessionId === "string" ? record.sessionId : "",
    raterName: typeof record.raterName === "string" ? record.raterName : "",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    bestOverall:
      record.bestOverall && typeof record.bestOverall === "object"
        ? {
            names: Array.isArray(record.bestOverall.names) ? record.bestOverall.names : [],
            score: record.bestOverall.score ?? null,
          }
        : { names: [], score: null },
    bestByCategory: Array.isArray(record.bestByCategory) ? record.bestByCategory : [],
    categoryAverages: Array.isArray(record.categoryAverages) ? record.categoryAverages : [],
    rankedRows: Array.isArray(record.rankedRows) ? record.rankedRows : [],
    coachInsights: Array.isArray(record.coachInsights) ? record.coachInsights : [],
    commentsByPerson:
      record.commentsByPerson && typeof record.commentsByPerson === "object"
        ? record.commentsByPerson
        : {},
  };
}

function mapRevealRow(row) {
  return sanitizeRevealRecord({
    ...(row.reveal_data ?? {}),
    sessionId: row.session_id,
    raterName: row.rater_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapActivityLogRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    ...(row.event_data ?? {}),
    id: row.id,
    timestamp: row.timestamp,
    sessionId: row.session_id ?? row.event_data?.sessionId ?? "",
    raterName: row.rater_name ?? row.event_data?.raterName ?? "",
    type: row.event_type ?? row.event_data?.type ?? "",
    summary: row.summary ?? row.event_data?.summary ?? "",
  };
}

export function isSharedResultsEnabled() {
  return sharedStorageEnabled;
}

export async function fetchSharedRevealRecords() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("rating_reveals")
    .select("session_id, rater_name, created_at, updated_at, reveal_data")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRevealRow).filter(Boolean);
}

export async function saveSharedRevealRecord(record) {
  if (!supabase) {
    return null;
  }

  const payload = {
    session_id: record.sessionId,
    rater_name: record.raterName,
    updated_at: record.updatedAt,
    reveal_data: record,
  };

  const { data, error } = await supabase
    .from("rating_reveals")
    .upsert(payload, { onConflict: "session_id" })
    .select("session_id, rater_name, created_at, updated_at, reveal_data")
    .single();

  if (error) {
    throw error;
  }

  return mapRevealRow(data);
}

export async function fetchSharedActivityLog(limit = 250) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("rating_activity_logs")
    .select("id, timestamp, session_id, rater_name, event_type, summary, event_data")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapActivityLogRow).filter(Boolean);
}

export async function saveSharedActivityEntries(entries) {
  if (!supabase || !entries.length) {
    return [];
  }

  const payload = entries.map((entry) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    session_id: entry.sessionId || null,
    rater_name: entry.raterName || null,
    event_type: entry.type,
    summary: entry.summary || null,
    event_data: entry,
  }));

  const { data, error } = await supabase
    .from("rating_activity_logs")
    .upsert(payload, { onConflict: "id" })
    .select("id, timestamp, session_id, rater_name, event_type, summary, event_data");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapActivityLogRow).filter(Boolean);
}
