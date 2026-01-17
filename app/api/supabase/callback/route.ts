export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  // Create HTML that sends the code back to the opener window
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Supabase Authorization</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #1a1a1a;
            color: #fff;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #333;
            border-top-color: #3ecf8e;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .error {
            color: #ef4444;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${
            error
              ? `
            <p class="error">Authorization failed: ${error}</p>
            <p>You can close this window.</p>
          `
              : `
            <div class="spinner"></div>
            <p>Completing authorization...</p>
          `
          }
        </div>
        <script>
          ${
            error
              ? `
            // Close window after showing error
            setTimeout(() => window.close(), 3000);
          `
              : `
            // Send the code back to the opener
            if (window.opener) {
              window.opener.postMessage({
                type: 'supabase-oauth-callback',
                code: '${code}',
                state: '${state}'
              }, window.location.origin);
              setTimeout(() => window.close(), 500);
            } else {
              document.querySelector('.container').innerHTML = '<p>Authorization complete. You can close this window.</p>';
            }
          `
          }
        </script>
      </body>
    </html>
  `

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  })
}
