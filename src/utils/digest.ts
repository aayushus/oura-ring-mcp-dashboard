import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import {
  getDb,
  getUserProfile,
  getDigestLog,
  upsertDigestLog,
  getHistory,
} from "../db.js";

// Path to log digests locally for demonstration/manual verification
const DIGEST_FILE_LOG = "/Users/aayush/.gemini/antigravity/morning_digest_log.json";

interface DigestDetails {
  date: string;
  sleepScore: number | null;
  sleepDelta: string;
  readinessScore: number | null;
  readinessDelta: string;
  activityScore: number | null;
  activityDelta: string;
  headline: string;
  worstContributor: string;
  contributorTip: string;
  timestamp: string;
}

export async function checkAndSendDigest(): Promise<void> {
  const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local format

  // 1. Check if already dispatched today
  const existingLog = await getDigestLog(today);
  if (existingLog) {
    return;
  }

  // 2. Fetch User Profile for target wake time
  const profile = await getUserProfile();
  const targetWake = profile?.target_wake_time || "07:00"; // default 7 AM
  const [wakeH, wakeM] = targetWake.split(":").map(Number);

  // Compute wake + 30 min and wake + 3 hours
  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  const wakeTimeMinutes = wakeH * 60 + wakeM;
  const currentTimeMinutes = currentH * 60 + currentM;

  // Check if we are past target_wake_time + 30m
  if (currentTimeMinutes < wakeTimeMinutes + 30) {
    return;
  }

  // 3. Check for last night's data (Wait-for-data loop)
  const db = await getDb();
  const sleepRecord = await db.get("SELECT * FROM sleep_history WHERE day = ?", [today]);
  const isPastThreeHours = currentTimeMinutes >= wakeTimeMinutes + 180;

  if (!sleepRecord) {
    if (!isPastThreeHours) {
      // Data not present yet, but within the 3-hour window -> wait (check next tick)
      console.log(`[Digest] Sleep data not found for ${today}. Waiting for phone sync...`);
      return;
    }

    // Fallback after 3 hours
    console.log(`[Digest] Sleep data still missing after 3 hours. Dispatching fallback alert.`);
    await sendFallbackDigest(today);
    return;
  }

  // 4. Generate Full Metrics Digest
  const history = await getHistory(7);
  const sleepRows = history.sleep;
  const readinessRows = history.readiness;
  const activityRows = history.activity;

  // Latest scores (today)
  const latestSleep = sleepRows.find((r) => r.day === today)?.score || null;
  const latestReadiness = readinessRows.find((r) => r.day === today)?.score || null;
  const latestActivity = activityRows.find((r) => r.day === today)?.score || null;

  // Previous scores (yesterday)
  const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString("sv-SE");
  const prevSleep = sleepRows.find((r) => r.day === yesterday)?.score || null;
  const prevReadiness = readinessRows.find((r) => r.day === yesterday)?.score || null;
  const prevActivity = activityRows.find((r) => r.day === yesterday)?.score || null;

  const calcDelta = (curr: number | null, prev: number | null) => {
    if (curr === null || prev === null) return "—";
    const diff = curr - prev;
    return diff >= 0 ? `▲ ${diff}` : `▼ ${Math.abs(diff)}`;
  };

  // Headline Insight Heuristic
  let headline = "Your biometrics are within normal ranges today.";
  if (latestReadiness !== null && latestReadiness < 70) {
    headline = "Readiness is low. Prioritize recovery and lighter activities today.";
  } else if (latestSleep !== null && latestSleep < 70) {
    headline = "Sleep was truncated or restless. Focus on an earlier bedtime tonight.";
  }

  // Determine Worst Contributor from raw records
  let worstContributor = "Restfulness";
  let contributorTip = "Ensure your bedroom is dark, quiet, and cool to minimize nighttime wakeups.";

  const latestRawSleep = await db.get("SELECT * FROM raw_documents WHERE day = ? AND endpoint = 'sleep'", [today]);
  if (latestRawSleep) {
    try {
      const doc = JSON.parse(latestRawSleep.data);
      if (doc.contributors) {
        let minScore = 100;
        for (const [name, val] of Object.entries(doc.contributors)) {
          if (typeof val === "number" && val < minScore) {
            minScore = val;
            worstContributor = name.replace(/_/g, " ");
          }
        }
      }
    } catch (e) {
      // fallback
    }
  }

  const digest: DigestDetails = {
    date: today,
    sleepScore: latestSleep,
    sleepDelta: calcDelta(latestSleep, prevSleep),
    readinessScore: latestReadiness,
    readinessDelta: calcDelta(latestReadiness, prevReadiness),
    activityScore: latestActivity,
    activityDelta: calcDelta(latestActivity, prevActivity),
    headline,
    worstContributor,
    contributorTip,
    timestamp: new Date().toISOString(),
  };

  // 5. Send Digest via Channels
  await dispatchDigest(digest);

  // 6. Log success to DB
  await upsertDigestLog({
    date: today,
    channel: "Email/LocalFile",
    sent_at: new Date().toISOString(),
    had_data: 1,
  });
  console.log(`[Digest] Successfully dispatched biometrics digest for ${today}`);

}

async function sendFallbackDigest(date: string): Promise<void> {
  const fallbackHtml = `
    <h2>Morning Digest</h2>
    <p>No sleep data has been synced for today (${date}) yet.</p>
    <p>Please open the Oura phone app to trigger data synchronization with the cloud.</p>
  `;
  
  await sendEmail("Oura Morning Digest — Action Required", fallbackHtml);
  logToFile({
    date,
    message: "No sleep data yet — open the Oura app to sync.",
    timestamp: new Date().toISOString(),
  });

  await upsertDigestLog({
    date,
    channel: "Email/LocalFile",
    sent_at: new Date().toISOString(),
    had_data: 0,
  });
}

async function dispatchDigest(digest: DigestDetails): Promise<void> {
  const subject = `Oura Morning Digest — Readiness: ${digest.readinessScore || "—"} (${digest.headline})`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 12px;">
      <h2 style="margin-top:0;">Good Morning! Here is your daily digest for ${digest.date}</h2>
      <p style="font-size: 1.1em; font-weight: bold; color: #333;">${digest.headline}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #eee;">
          <th style="text-align: left; padding: 8px;">Metric</th>
          <th style="text-align: right; padding: 8px;">Today's Score</th>
          <th style="text-align: right; padding: 8px;">Delta</th>
        </tr>
        <tr>
          <td style="padding: 8px;">Readiness</td>
          <td style="text-align: right; padding: 8px; font-weight: bold;">${digest.readinessScore || "—"}</td>
          <td style="text-align: right; padding: 8px; color: ${digest.readinessDelta.includes("▼") ? "red" : "green"}">${digest.readinessDelta}</td>
        </tr>
        <tr>
          <td style="padding: 8px;">Sleep Quality</td>
          <td style="text-align: right; padding: 8px; font-weight: bold;">${digest.sleepScore || "—"}</td>
          <td style="text-align: right; padding: 8px; color: ${digest.sleepDelta.includes("▼") ? "red" : "green"}">${digest.sleepDelta}</td>
        </tr>
        <tr>
          <td style="padding: 8px;">Activity Load</td>
          <td style="text-align: right; padding: 8px; font-weight: bold;">${digest.activityScore || "—"}</td>
          <td style="text-align: right; padding: 8px; color: ${digest.activityDelta.includes("▼") ? "red" : "green"}">${digest.activityDelta}</td>
        </tr>
      </table>

      <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; margin-top: 20px;">
        <strong style="color: #c2410c;">Worst Contributor Alert: ${digest.worstContributor}</strong>
        <p style="margin: 6px 0 0 0; font-size: 0.9em; color: #555;">${digest.contributorTip}</p>
      </div>
    </div>
  `;

  await sendEmail(subject, html);
  logToFile(digest);
}

// SMTP Email Sender Utility
async function sendEmail(subject: string, html: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[Digest] SMTP credentials not set. Logging email subject to console: "${subject}"`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Oura++ Dashboard" <${user}>`,
    to: user, // Sends to self by default
    subject,
    html,
  });
}

function logToFile(data: any) {
  try {
    let logs: any[] = [];
    const dir = path.dirname(DIGEST_FILE_LOG);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(DIGEST_FILE_LOG)) {
      const content = fs.readFileSync(DIGEST_FILE_LOG, "utf8");
      logs = JSON.parse(content);
    }
    logs.push(data);
    fs.writeFileSync(DIGEST_FILE_LOG, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.error("[Digest] Failed to write digest log file:", err);
  }
}

// Background scheduler ticker setup
let digestIntervalId: NodeJS.Timeout | null = null;

export function startDigestScheduler(): void {
  if (digestIntervalId) return;

  console.log("[Digest] Initializing Daily Morning Digest Scheduler (checks every 15 minutes)...");
  
  // Check once immediately on start
  checkAndSendDigest().catch((err) => {
    console.error("[Digest] Error generating daily morning digest:", err);
  });

  // Tick every 15 minutes
  digestIntervalId = setInterval(() => {
    checkAndSendDigest().catch((err) => {
      console.error("[Digest] Error generating daily morning digest:", err);
    });
  }, 15 * 60 * 1000);
}

export function stopDigestScheduler(): void {
  if (digestIntervalId) {
    clearInterval(digestIntervalId);
    digestIntervalId = null;
  }
}
