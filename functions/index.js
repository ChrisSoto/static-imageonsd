/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

/* eslint-disable require-jsdoc */

// https://cloud.google.com/functions/docs/writing/write-http-functions#handling_cors_requests

const {initializeApp} = require("firebase-admin/app");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {getFirestore} = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();

const leadsDashboardPassword = defineSecret("LEADS_DASHBOARD_PASSWORD");
const leadLocations = ["Santee", "Downtown"];
const leadsDashboardOrigins = [
  "https://imageonsd.com",
  "https://www.imageonsd.com",
  "https://dev.imageonsd.com",
  "https://staging.imageonsd.com",
  "http://localhost:8080",
];
const sessionCookieName = "__Host-leads_session";
const sessionLifetimeSeconds = 8 * 60 * 60;
const pacificDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");

  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getDashboardSecret() {
  return leadsDashboardPassword.value();
}

function createSessionToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Date.now() + (sessionLifetimeSeconds * 1000),
    nonce: crypto.randomBytes(16).toString("hex"),
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

  return `${payload}.${signature}`;
}

function isValidSessionToken(token, secret) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [payload, signature] = token.split(".");
  const expectedSignature = crypto.createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch (error) {
    return false;
  }
}

function readCookie(request, cookieName) {
  const cookies = request.get("cookie") || "";
  for (const cookie of cookies.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    const name = cookie.slice(0, separatorIndex).trim();
    if (separatorIndex > -1 && name === cookieName) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1));
    }
  }
  return "";
}

function hasValidDashboardSession(request) {
  const authorization = request.get("authorization") || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1] :
    readCookie(request, sessionCookieName);
  return isValidSessionToken(token, getDashboardSecret());
}

function setPrivateResponseHeaders(response) {
  response.set("Cache-Control", "private, no-store, max-age=0");
  response.set("Pragma", "no-cache");
  response.set("X-Content-Type-Options", "nosniff");
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) {
    return null;
  }
  return {year, month, day};
}

function getTimeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
  );
  const timeInZone = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
  );
  return timeInZone - date.getTime();
}

function getPacificMidnight(dateParts) {
  const utcGuess = Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
  );
  let result = new Date(utcGuess);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    result = new Date(utcGuess - getTimeZoneOffset(
        result,
        "America/Los_Angeles",
    ));
  }
  return result;
}

function addCalendarDays(dateParts, days) {
  const date = new Date(Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day + days,
  ));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatDateParts(dateParts) {
  return [
    String(dateParts.year).padStart(4, "0"),
    String(dateParts.month).padStart(2, "0"),
    String(dateParts.day).padStart(2, "0"),
  ].join("-");
}

function formatPacificDate(date) {
  const parts = pacificDateFormatter.formatToParts(date);
  const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function decodeHtmlEntities(value) {
  return value
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (match, code) =>
        String.fromCodePoint(parseInt(code, 16)));
}

function htmlToText(value) {
  return decodeHtmlEntities(String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
}

function parseLeadFields(message = {}) {
  const result = {};
  const html = String(message.html || "");
  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match = paragraphPattern.exec(html);

  while (match) {
    const text = htmlToText(match[1]);
    const separatorIndex = text.indexOf(":");
    if (separatorIndex > -1) {
      const label = text.slice(0, separatorIndex).trim().toLowerCase();
      const value = text.slice(separatorIndex + 1).trim();
      if (["name", "email", "phone", "details"].includes(label)) {
        result[label] = value;
      }
    }
    match = paragraphPattern.exec(html);
  }

  if (Object.keys(result).length < 4) {
    const body = String(message.body || "").replace(/\s+/g, " ").trim();
    const fieldPattern = new RegExp(
        "(?:^|\\s)(Name|Phone|Details|Email):\\s*([\\s\\S]*?)" +
        "(?=\\s+(?:Name|Phone|Details|Email):|$)",
        "gi",
    );
    let fieldMatch = fieldPattern.exec(body);
    while (fieldMatch) {
      const label = fieldMatch[1].toLowerCase();
      if (!result[label]) {
        result[label] = fieldMatch[2].trim();
      }
      fieldMatch = fieldPattern.exec(body);
    }
  }

  return {
    name: result.name || "",
    email: result.email || "",
    phone: result.phone || "",
    details: result.details || "",
  };
}

function getLeadLocation(data) {
  const subject = String(data.message && data.message.subject || "");
  const subjectMatch = subject.match(/@\s*(Santee|Downtown)\s*$/i);
  if (subjectMatch) {
    return leadLocations.find((location) =>
      location.toLowerCase() === subjectMatch[1].toLowerCase());
  }

  const recipients = String(data.to || "").toLowerCase();
  if (recipients.includes("imageonsantee")) return "Santee";
  if (recipients.includes("imageondowntown")) return "Downtown";
  return null;
}

exports.addContact = onRequest(
    {cors: ["https://imageonsd.com", "https://dev.imageonsd.com", "https://staging.imageonsd.com", "http://localhost:8080"]},
    async (request, response) => {
      const {name, email, phone, location, details} = request.body;

      let writeResult = null;

      if (!email) {
        response.status(400).json({error: "Missing required fields"});
      } else {
        let emails = "";
        if (location == "Santee") {
          emails = "imageonsantee@gmail.com, admin@imageonsd.com";

        } else if (location == "Downtown") {
          emails = "imageondowntown@gmail.com, admin@imageonsd.com";
        } else {
          emails = "admin@imageonsd.com";
        }

        writeResult = await getFirestore()
            .collection("contacts")
            .add({
              to: emails,
              message: {
                subject: `Lead from Site: ${name} @ ${location}`,
                body: `Name: ${name}\n
                  Phone: ${phone}\n
                  Details: ${details}\n
                  Email: ${email}`,
                html: `<p>Name: ${name}</p><br>
                  <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                  <p>Phone: <a href="tel:${phone}">${phone}</a></p><br>
                  <p>Details: ${details}</p>`,
              },
            });
        response.json({result: `Message written with ID: ${writeResult.id}`});
      }
    });


exports.addPPDContact = onRequest(
    {cors: ["http://localhost:8080", "https://pepperfarmdeli.com"]},
    async (request, response) => {
      const {name, email, phone, question} = request.body;

      let writeResult = null;

      if (!email) {
        response.status(400).json({error: "Missing required fields"});
      } else {
        writeResult = await getFirestore()
            .collection("contacts")
            .add({
              to: "pepperfarmdeli@gmail.com",
              message: {
                subject: `Question from: ${name}`,
                body: `Name: ${name}\n
                  Phone: ${phone}\n
                  Email: ${email}\n
                  Question: ${question}`,
                html: `<p>Name: ${name}</p><br>
                  <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                  <p>Phone: <a href="tel:${phone}">${phone}</a></p><br>
                  <p>Question: ${question}</p>`,
              },
            });
        response.json({result: `Message written with ID: ${writeResult.id}`});
      }
    });


exports.addPPDCateringContact = onRequest(
    {cors: ["http://localhost:8080", "https://pepperfarmdeli.com"]},
    async (request, response) => {
      const {
        name,
        email,
        phone,
        eventDate,
        guests,
        eventType,
        pickup,
        location,
        comments,
      } = request.body;

      let writeResult = null;

      if (!email) {
        response.status(400).json({error: "Missing required fields"});
      } else {
        writeResult = await getFirestore()
            .collection("contacts")
            .add({
              to: "pepperfarmdeli@gmail.com",
              message: {
                subject: `Catering Inquiry from: ${name}`,
                body: `Name: ${name}\n
                  Phone: ${phone}\n
                  Email: ${email}\n
                  Event Date: ${eventDate}\n
                  Guests: ${guests}\n
                  Event Type: ${eventType}\n
                  Pickup: ${pickup}\n
                  Location: ${location}\n
                  Comments: ${comments}`,
                html: `<p>Name: ${name}</p><br>
                  <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                  <p>Phone: <a href="tel:${phone}">${phone}</a></p><br>
                  <p>Event Date: ${eventDate}</p><br>
                  <p>Guests: ${guests}</p><br>
                  <p>Event Type: ${eventType}</p><br>
                  <p>Pickup: ${pickup}</p><br>
                  <p>Location: ${location}</p><br>
                  <p>Comments: ${comments}</p>`,
              },
            });
        response.json({result: `Message written with ID: ${writeResult.id}`});
      }
    });

// because I changed the way data gets parsed by the javascript on the website,
// I'm not using the same destructuring as the one above

exports.addC9DContact = onRequest(
    {cors: ["http://localhost:8080", "https://cloud9delisd.com"]},
    async (request, response) => {
      const {fullName, eMail, phoneNumber, question} = request.body;

      let writeResult = null;

      if (!eMail) {
        response.status(400).json({error: "Missing required fields"});
      } else {
        writeResult = await getFirestore()
            .collection("contacts")
            .add({
              to: "cloud9delisd@gmail.com",
              message: {
                subject: `Question from: ${fullName}`,
                body: `Name: ${fullName}\n
                  Phone: ${phoneNumber}\n
                  Email: ${eMail}\n
                  Question: ${question}`,
                html: `<p>Name: ${fullName}</p><br>
                  <p>Email: <a href="mailto:${eMail}">${eMail}</a></p><br>
                  <p>Phone: <a href="tel:${phoneNumber}">
                    ${phoneNumber}</a></p><br>
                  <p>Question: ${question}</p>`,
              },
            });
        response.json({result: `Message written with ID: ${writeResult.id}`});
      }
    });


exports.addC9DCateringContact = onRequest(
    {cors: ["http://localhost:8080", "https://cloud9delisd.com"]},
    async (request, response) => {
      const {
        fullName,
        email,
        phone,
        comments,
        summary,
      } = request.body;

      let writeResult = null;

      if (!email) {
        response.status(400).json({error: "Missing required fields"});
      } else {
        writeResult = await getFirestore()
            .collection("contacts")
            .add({
              to: "cloud9delisd@gmail.com",
              message: {
                subject: `Catering Inquiry from: ${fullName}`,
                body: `Name: ${fullName}\n
                  Phone: ${phone}\n
                  Email: ${email}\n
                  Comments: ${comments}\n
                  Summary: ${summary}`,
                html: `<p>Name: ${fullName}</p><br>
                  <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                  <p>Phone: <a href="tel:${phone}">
                    ${phone}</a></p><br>
                  <p>Comments: ${comments}</p><br><br>
                  Summary: ${summary}`,
              },
            });
        response.json({result: `Message written with ID: ${writeResult.id}`});
      }
    });


exports.leadsLogin = onRequest(
    {cors: leadsDashboardOrigins, secrets: [leadsDashboardPassword]},
    async (request, response) => {
      setPrivateResponseHeaders(response);
      if (request.method !== "POST") {
        response.set("Allow", "POST");
        response.status(405).json({error: "Method not allowed"});
        return;
      }

      const submittedPassword = String(request.body &&
        request.body.password || "");
      const secret = getDashboardSecret();
      if (!safeEqual(submittedPassword, secret)) {
        response.status(401).json({error: "Incorrect password"});
        return;
      }

      const token = createSessionToken(secret);
      response.set("Set-Cookie", [
        `${sessionCookieName}=${encodeURIComponent(token)}`,
        "Path=/",
        `Max-Age=${sessionLifetimeSeconds}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
      ].join("; "));
      response.json({authenticated: true, token});
    },
);


exports.leadsLogout = onRequest(
    {cors: leadsDashboardOrigins, secrets: [leadsDashboardPassword]},
    async (request, response) => {
      setPrivateResponseHeaders(response);
      if (request.method !== "POST") {
        response.set("Allow", "POST");
        response.status(405).json({error: "Method not allowed"});
        return;
      }

      response.set("Set-Cookie", [
        `${sessionCookieName}=`,
        "Path=/",
        "Max-Age=0",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
      ].join("; "));
      response.json({authenticated: false});
    },
);


exports.getLeadStats = onRequest(
    {
      cors: leadsDashboardOrigins,
      secrets: [leadsDashboardPassword],
      timeoutSeconds: 60,
    },
    async (request, response) => {
      setPrivateResponseHeaders(response);
      if (request.method !== "GET") {
        response.set("Allow", "GET");
        response.status(405).json({error: "Method not allowed"});
        return;
      }
      if (!hasValidDashboardSession(request)) {
        response.status(401).json({error: "Authentication required"});
        return;
      }

      const startParts = parseDate(String(request.query.start || ""));
      const endParts = parseDate(String(request.query.end || ""));
      const requestedLocation = String(request.query.location || "All");
      if (!startParts || !endParts) {
        response.status(400).json({
          error: "Start and end must use the YYYY-MM-DD format",
        });
        return;
      }
      if (requestedLocation !== "All" &&
          !leadLocations.includes(requestedLocation)) {
        response.status(400).json({error: "Unknown location"});
        return;
      }

      const startDate = getPacificMidnight(startParts);
      const endExclusiveParts = addCalendarDays(endParts, 1);
      const endExclusiveDate = getPacificMidnight(endExclusiveParts);
      const rangeInDays = Math.round(
          (Date.UTC(endExclusiveParts.year, endExclusiveParts.month - 1,
              endExclusiveParts.day) -
           Date.UTC(startParts.year, startParts.month - 1, startParts.day)) /
          86400000,
      );
      if (rangeInDays < 1 || rangeInDays > 366) {
        response.status(400).json({
          error: "Choose a date range between 1 and 366 days",
        });
        return;
      }

      try {
        const snapshot = await getFirestore()
            .collection("contacts")
            .where("delivery.startTime", ">=", startDate)
            .where("delivery.startTime", "<", endExclusiveDate)
            .orderBy("delivery.startTime", "desc")
            .get();
        const totals = Object.fromEntries(
            leadLocations.map((location) => [location, 0]),
        );
        const daily = {};
        const records = [];

        for (let index = 0; index < rangeInDays; index += 1) {
          const date = formatDateParts(addCalendarDays(startParts, index));
          daily[date] = Object.fromEntries(
              leadLocations.map((location) => [location, 0]),
          );
        }

        snapshot.forEach((document) => {
          const data = document.data();
          const location = getLeadLocation(data);
          const timestamp = data.delivery && data.delivery.startTime;
          if (!location || !timestamp ||
              (requestedLocation !== "All" &&
               location !== requestedLocation)) {
            return;
          }

          const receivedAt = timestamp.toDate();
          const date = formatPacificDate(receivedAt);
          const fields = parseLeadFields(data.message);
          totals[location] += 1;
          if (daily[date]) daily[date][location] += 1;
          records.push({
            id: document.id,
            receivedAt: receivedAt.toISOString(),
            location,
            name: fields.name,
            email: fields.email,
            phone: fields.phone,
            details: fields.details,
            deliveryState: data.delivery.state || "",
          });
        });

        const series = Object.entries(daily).map(([date, counts]) => ({
          date,
          ...counts,
          total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        }));
        response.json({
          start: formatDateParts(startParts),
          end: formatDateParts(endParts),
          location: requestedLocation,
          total: records.length,
          totals,
          series,
          records,
        });
      } catch (error) {
        console.error("Unable to load lead dashboard data", error);
        response.status(500).json({error: "Unable to load leads"});
      }
    },
);
