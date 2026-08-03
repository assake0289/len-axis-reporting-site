const COOKIE_NAME = "la_session";
const SALT = "lenaxis-reporting-2026";

async function makeToken(password) {
  const enc = new TextEncoder().encode(SALT + ":" + password);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loginPage({ error } = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LEN-Axis · Reporting Commercial</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    height: 100%;
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 30% 20%, #2f7fe0 0%, #1c5cab 45%, #10346b 100%);
    min-height: 100%;
    padding: 24px;
  }
  .card {
    background: #ffffff;
    border-radius: 16px;
    padding: 40px 36px 32px;
    width: 100%;
    max-width: 360px;
    box-shadow: 0 24px 60px rgba(10, 30, 70, 0.35);
    text-align: center;
  }
  .logo {
    height: 44px;
    margin: 0 auto 8px;
    display: block;
  }
  .logo-fallback {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #10346b;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 28px;
  }
  form { text-align: left; }
  label {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
  }
  input[type="password"] {
    width: 100%;
    padding: 11px 13px;
    border-radius: 9px;
    border: 1px solid #d7dbe3;
    font-size: 15px;
    font-family: inherit;
    margin-bottom: 14px;
    background: #f9fafb;
  }
  input[type="password"]:focus {
    outline: none;
    border-color: #2a78d6;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(42, 120, 214, 0.15);
  }
  button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 9px;
    background: #1c5cab;
    color: #fff;
    font-size: 14.5px;
    font-weight: 650;
    font-family: inherit;
    cursor: pointer;
  }
  button:hover { background: #164a8a; }
  .error {
    background: #fdecec;
    color: #b3261e;
    font-size: 13px;
    padding: 9px 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .footer {
    margin-top: 22px;
    font-size: 11.5px;
    color: #9aa1ac;
  }
</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="/logo-lenaxis.png" alt="LEN-Axis" onerror="this.style.display='none';document.getElementById('lf').style.display='block';">
    <div class="logo-fallback" id="lf" style="display:none;">LEN-AXIS</div>
    <div class="subtitle">Reporting Commercial</div>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="POST" action="/__login">
      <label for="password">Mot de passe</label>
      <input type="password" id="password" name="password" autofocus required autocomplete="current-password">
      <button type="submit">Se connecter</button>
    </form>
    <div class="footer">Accès réservé — LEN Médical &amp; Axis Santé</div>
  </div>
</body>
</html>`;
}

export default async (req, context) => {
  const url = new URL(req.url);
  const expected = Netlify.env.get("SITE_PASSWORD") || "LenMedical*";
  const expectedToken = await makeToken(expected);

  if (req.method === "POST" && url.pathname === "/__login") {
    const form = await req.formData();
    const pw = form.get("password") || "";
    if (pw === expected) {
      const token = await makeToken(pw);
      const headers = new Headers();
      headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
      );
      headers.append("Location", "/");
      return new Response(null, { status: 303, headers });
    }
    return new Response(loginPage({ error: "Mot de passe incorrect." }), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/la_session=([a-f0-9]+)/);
  if (match && match[1] === expectedToken) {
    return context.next();
  }

  return new Response(loginPage(), {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

export const config = {
  path: "/*",
};
