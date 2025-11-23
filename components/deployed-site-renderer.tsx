'use client'

import { useEffect, useRef, useState } from 'react'
import type { File } from '@/config/schema'

interface DeployedSiteRendererProps {
  files: File[]
  projectTitle: string
  showBranding: boolean
}

export function DeployedSiteRenderer({ 
  files, 
  projectTitle,
  showBranding 
}: DeployedSiteRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[v0] Starting deployment render with', files.length, 'files')
    
    if (files.length === 0) {
      setError('No files to render')
      setLoading(false)
      return
    }

    try {
      const htmlContent = buildDeploymentHTML(files, projectTitle)

      if (iframeRef.current) {
        const iframe = iframeRef.current
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        
        if (doc) {
          doc.open()
          doc.write(htmlContent)
          doc.close()
          
          window.addEventListener('message', (e) => {
            if (e.data?.type === 'DEPLOY_ERROR') {
              console.error('[v0] Deploy error from iframe:', e.data.error)
              setError(e.data.error)
              setLoading(false)
            } else if (e.data?.type === 'DEPLOY_SUCCESS') {
              console.log('[v0] Site loaded successfully')
              setLoading(false)
            }
          })
          
          // Fallback timeout
          setTimeout(() => {
            setLoading(false)
          }, 3000)
        } else {
          throw new Error('Could not access iframe document')
        }
      }
    } catch (err) {
      console.error('[v0] Render error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [files, projectTitle])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-bold text-red-600">Deployment Error</h1>
          <p className="text-gray-700 mt-2">{error}</p>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-blue-600">Show Debug Info</summary>
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-64">
              <div><strong>Files ({files.length}):</strong></div>
              {files.map((f, i) => (
                <div key={i}>• {f.path} ({f.language}) - {f.content?.length || 0} chars</div>
              ))}
            </div>
          </details>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Building your site...</p>
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        title={projectTitle}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
      
      {showBranding && (
        <a 
          href="https://falbor.xyz" 
          target="_blank" 
          rel="noopener noreferrer"
          className="absolute bottom-4 right-4 bg-black/90 hover:bg-black text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg transition-colors"
        >
          <span>Built with</span>
          <span className="font-bold">falbor.xyz</span>
        </a>
      )}
    </div>
  )
}

function buildDeploymentHTML(files: File[], projectTitle: string): string {
  // Separate files by type
  const tsxFiles = files.filter(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'))
  const cssFiles = files.filter(f => f.path.endsWith('.css'))
  const tsFiles = files.filter(f => f.path.endsWith('.ts') && !f.path.endsWith('.tsx'))

  // Find entry point
  let entryFile = tsxFiles.find(f => f.path === 'app/page.tsx')
  if (!entryFile) entryFile = tsxFiles.find(f => f.path.endsWith('page.tsx'))
  if (!entryFile) entryFile = tsxFiles.find(f => f.path.includes('app.tsx'))
  if (!entryFile) entryFile = tsxFiles[0]

  if (!entryFile) {
    throw new Error('No React component found')
  }

  // Combine all CSS
  const combinedCSS = cssFiles.map(f => f.content).join('\n\n')

  // Build module system
  const modules = createModuleSystem(tsxFiles, tsFiles)
  const entryModuleName = getModuleName(entryFile.path)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(projectTitle)}</title>
  
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    * { margin: 0; padding: 0; }
    body { 
      line-height: 1.5; 
      -webkit-font-smoothing: antialiased;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    img, picture, video, canvas, svg { display: block; max-width: 100%; }
    input, button, textarea, select { font: inherit; }
    
    ${combinedCSS}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <!-- Load dependencies in correct order -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  
  <script>
    // Wait for all scripts to load before proceeding
    window.addEventListener('load', function() {
      console.log('[Deploy] All resources loaded, starting app...');
      
      // Configure Tailwind
      if (window.tailwind) {
        window.tailwind.config = {
          darkMode: 'class',
          theme: { extend: {} }
        };
      }
      
      // Babel inline compilation
      const babelScript = document.createElement('script');
      babelScript.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
      babelScript.onload = function() {
        console.log('[Deploy] Babel loaded, compiling app...');
        initializeApp();
      };
      babelScript.onerror = function() {
        showError('Failed to load Babel compiler');
      };
      document.head.appendChild(babelScript);
    });
    
    function initializeApp() {
      try {
        // Transform and execute the app code
        const code = \`
          const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext } = React;
          const { createRoot } = ReactDOM;
          const icons = window.lucide || {};
          
          // Module system
          const modules = {};
          const moduleCache = {};
          
          function require(moduleName) {
            if (moduleName === 'react') return React;
            if (moduleName === 'react-dom') return ReactDOM;
            if (moduleName === 'lucide-react') return icons;
            
            if (moduleName.startsWith('./') || moduleName.startsWith('../') || moduleName.startsWith('@/')) {
              const cleanName = moduleName
                .replace(/^\\.\\//, '')
                .replace(/^\\.\\.\\//, '')
                .replace(/^@\\//, '')
                .replace(/\\\\/g, '/');
              
              if (moduleCache[cleanName]) {
                return moduleCache[cleanName];
              }
              
              if (modules[cleanName]) {
                const exports = {};
                modules[cleanName](exports, require);
                moduleCache[cleanName] = exports.default || exports;
                return moduleCache[cleanName];
              }
            }
            
            console.warn('[Module] Not found:', moduleName);
            return {};
          }
          
${modules}
          
          // Render
          const rootElement = document.getElementById('root');
          const App = require('${entryModuleName}');
          const AppComponent = App.default || App;
          
          if (typeof AppComponent === 'function') {
            const root = createRoot(rootElement);
            root.render(React.createElement(AppComponent));
            window.parent.postMessage({ type: 'DEPLOY_SUCCESS' }, '*');
            console.log('[Deploy] ✓ Rendered successfully');
          } else {
            throw new Error('No valid React component exported');
          }
        \`;
        
        // Compile and execute
        const transformed = Babel.transform(code, {
          presets: ['react'],
          filename: 'app.jsx'
        }).code;
        
        eval(transformed);
        
      } catch (error) {
        console.error('[Deploy] Error:', error);
        showError(error.message);
        window.parent.postMessage({ 
          type: 'DEPLOY_ERROR', 
          error: error.message 
        }, '*');
      }
    }
    
    function showError(message) {
      document.getElementById('root').innerHTML = \`
        <div style="padding: 2rem; max-width: 600px; margin: 2rem auto; background: #fee; border: 2px solid #c33; border-radius: 8px;">
          <h1 style="color: #c33; margin-bottom: 1rem;">⚠️ Render Error</h1>
          <p style="margin-bottom: 1rem;">\${message}</p>
          <p style="font-size: 14px; color: #666;">Check the browser console for more details.</p>
        </div>
      \`;
    }
  </script>
</body>
</html>`
}

function createModuleSystem(tsxFiles: File[], tsFiles: File[]): string {
  const allFiles = [...tsxFiles, ...tsFiles]
  
  return allFiles.map(file => {
    const moduleName = getModuleName(file.path)
    const transformedCode = transformCode(file.content, file.path)
    
    return `          // Module: ${file.path}
          modules['${moduleName}'] = function(exports, require) {
            ${transformedCode}
          };`
  }).join('\n\n')
}

function getModuleName(path: string): string {
  return path
    .replace(/^(app\/|components\/|lib\/|pages\/|src\/)/, '')
    .replace(/\.(tsx|ts|jsx|js)$/, '')
    .replace(/\\/g, '/')
}

function transformCode(code: string, filePath: string): string {
  let transformed = code
    .replace(/['"]use client['"]\s*;?/g, '')
    .replace(/['"]use server['"]\s*;?/g, '')
  
  // Transform imports
  transformed = transformed.replace(
    /import\s+((?:\*\s+as\s+\w+|\{[^}]+\}|\w+))\s+from\s+['"](.*?)['"]/g,
    (match, imports, source) => {
      if (imports.startsWith('* as ')) {
        const alias = imports.replace('* as ', '').trim()
        return `const ${alias} = require('${source}');`
      } else if (imports.startsWith('{')) {
        return `const ${imports} = require('${source}');`
      } else {
        return `const ${imports} = require('${source}').default || require('${source}');`
      }
    }
  )
  
  // Transform exports
  transformed = transformed.replace(
    /export\s+default\s+function\s+(\w+)/g,
    'const $1 = function $1'
  )
  transformed = transformed.replace(
    /export\s+default\s+/g,
    'exports.default = '
  )
  transformed = transformed.replace(
    /export\s+(const|function|class)\s+(\w+)/g,
    '$1 $2'
  )
  
  // Add default export if needed
  const namedExports = [...transformed.matchAll(/(?:const|function|class)\s+(\w+)/g)]
    .map(m => m[1])
    .filter(name => !['React', 'useState', 'useEffect'].includes(name))
  
  if (namedExports.length > 0 && !transformed.includes('exports.default')) {
    transformed += `\n            exports.default = { ${namedExports.join(', ')} };`
  }
  
  return transformed
}

function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}
