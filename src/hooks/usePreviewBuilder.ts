import { useMemo, useRef, useState, useEffect } from 'react';
import { ProjectFile } from '@/components/FileExplorer';

interface UsePreviewBuilderOptions {
  files: ProjectFile[];
  currentFileId: string | null;
  currentCode: string;
  enabled: boolean;
}

// Script injected before user code to capture console output and errors
const CONSOLE_CAPTURE_SCRIPT = `
<script>
(function() {
  var _orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    clear: console.clear
  };

  function serialize(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg, null, 2); }
      catch(e) { return String(arg); }
    }
    return String(arg);
  }

  ['log','warn','error','info'].forEach(function(method) {
    console[method] = function() {
      var args = Array.prototype.slice.call(arguments);
      _orig[method].apply(console, args);
      try {
        window.parent.postMessage({
          type: '__preview_console__',
          method: method,
          args: args.map(serialize),
          timestamp: Date.now()
        }, '*');
      } catch(e) {}
    };
  });

  console.clear = function() {
    _orig.clear.apply(console);
    try {
      window.parent.postMessage({
        type: '__preview_console__',
        method: 'clear',
        args: [],
        timestamp: Date.now()
      }, '*');
    } catch(e) {}
  };

  window.onerror = function(msg, src, line, col) {
    try {
      window.parent.postMessage({
        type: '__preview_console__',
        method: 'error',
        args: ['Uncaught Error: ' + msg + ' (line ' + line + ':' + col + ')'],
        timestamp: Date.now()
      }, '*');
    } catch(e) {}
    return false;
  };

  window.addEventListener('unhandledrejection', function(e) {
    try {
      window.parent.postMessage({
        type: '__preview_console__',
        method: 'error',
        args: ['Unhandled Promise Rejection: ' + (e.reason ? (e.reason.message || String(e.reason)) : 'unknown')],
        timestamp: Date.now()
      }, '*');
    } catch(err) {}
  });
})();
</script>`;

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function isHtmlFile(name: string): boolean {
  return getFileExtension(name) === 'html';
}

function isCssFile(name: string): boolean {
  const ext = getFileExtension(name);
  return ext === 'css' || ext === 'scss' || ext === 'sass';
}

function isJsFile(name: string): boolean {
  const ext = getFileExtension(name);
  return ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx';
}

/**
 * Gets the effective content for a file, using in-memory edits for the
 * currently selected file and saved content for everything else.
 */
function getContent(
  file: ProjectFile,
  currentFileId: string | null,
  currentCode: string
): string {
  if (file.id === currentFileId) return currentCode;
  return file.content || '';
}

/**
 * Builds a combined HTML document from all project files.
 */
function buildPreviewDocument(
  files: ProjectFile[],
  currentFileId: string | null,
  currentCode: string
): string {
  const nonFolderFiles = files.filter(f => !f.is_folder);

  // Separate files by type
  const htmlFiles = nonFolderFiles.filter(f => isHtmlFile(f.name));
  const cssFiles = nonFolderFiles.filter(f => isCssFile(f.name));
  const jsFiles = nonFolderFiles.filter(f => isJsFile(f.name));

  // Collect CSS content
  const cssBlocks = cssFiles
    .map(f => getContent(f, currentFileId, currentCode))
    .filter(c => c.trim())
    .map(c => `<style>\n${c}\n</style>`)
    .join('\n');

  // Collect JS content
  const jsBlocks = jsFiles
    .map(f => getContent(f, currentFileId, currentCode))
    .filter(c => c.trim())
    .map(c => `<script>\n${c}\n</script>`)
    .join('\n');

  // Find the primary HTML file (prefer index.html)
  let primaryHtml = htmlFiles.find(f => f.name.toLowerCase() === 'index.html');
  if (!primaryHtml && htmlFiles.length > 0) {
    primaryHtml = htmlFiles[0];
  }

  if (primaryHtml) {
    let htmlContent = getContent(primaryHtml, currentFileId, currentCode);

    // If the HTML already has external CSS <link> references or <style> blocks,
    // we still inject our combined CSS for other files
    // Inject console capture + CSS into <head>, JS before </body>

    // Check if <head> exists
    if (/<head[^>]*>/i.test(htmlContent)) {
      htmlContent = htmlContent.replace(
        /<head([^>]*)>/i,
        `<head$1>\n${CONSOLE_CAPTURE_SCRIPT}\n${cssBlocks}`
      );
    } else if (/<html[^>]*>/i.test(htmlContent)) {
      htmlContent = htmlContent.replace(
        /<html([^>]*)>/i,
        `<html$1>\n<head>\n${CONSOLE_CAPTURE_SCRIPT}\n${cssBlocks}\n</head>`
      );
    } else {
      // No html/head tags — wrap it
      htmlContent = `<!DOCTYPE html>
<html>
<head>
${CONSOLE_CAPTURE_SCRIPT}
${cssBlocks}
</head>
<body>
${htmlContent}
${jsBlocks}
</body>
</html>`;
      return htmlContent;
    }

    // Inject JS before </body> if it exists
    if (/<\/body>/i.test(htmlContent)) {
      htmlContent = htmlContent.replace(
        /<\/body>/i,
        `${jsBlocks}\n</body>`
      );
    } else if (/<\/html>/i.test(htmlContent)) {
      htmlContent = htmlContent.replace(
        /<\/html>/i,
        `${jsBlocks}\n</html>`
      );
    } else {
      htmlContent += `\n${jsBlocks}`;
    }

    return htmlContent;
  }

  // No HTML file exists — create a minimal wrapper
  if (cssBlocks || jsBlocks) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${CONSOLE_CAPTURE_SCRIPT}
${cssBlocks}
</head>
<body>
${jsBlocks}
</body>
</html>`;
  }

  // Nothing to preview
  return '';
}

export interface ConsoleEntry {
  id: string;
  method: 'log' | 'warn' | 'error' | 'info' | 'clear';
  args: string[];
  timestamp: number;
}

export function usePreviewBuilder({
  files,
  currentFileId,
  currentCode,
  enabled,
}: UsePreviewBuilderOptions) {
  const [previewDoc, setPreviewDoc] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();
  const entryIdRef = useRef(0);

  // Check if project has any previewable files
  const hasPreviewableFiles = useMemo(() => {
    const nonFolders = files.filter(f => !f.is_folder);
    return nonFolders.some(
      f => isHtmlFile(f.name) || isCssFile(f.name) || isJsFile(f.name)
    );
  }, [files]);

  // Debounced document rebuild
  useEffect(() => {
    if (!enabled || !hasPreviewableFiles) {
      setPreviewDoc('');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const doc = buildPreviewDocument(files, currentFileId, currentCode);
      setPreviewDoc(doc);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [files, currentFileId, currentCode, enabled, hasPreviewableFiles]);

  // Listen for console messages from iframe
  useEffect(() => {
    if (!enabled) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== '__preview_console__') return;

      const { method, args, timestamp } = event.data;

      if (method === 'clear') {
        setConsoleLogs([]);
        return;
      }

      const entry: ConsoleEntry = {
        id: `console-${entryIdRef.current++}`,
        method,
        args: args || [],
        timestamp: timestamp || Date.now(),
      };

      setConsoleLogs(prev => [...prev, entry]);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enabled]);

  const clearConsole = () => setConsoleLogs([]);

  return {
    previewDoc,
    consoleLogs,
    clearConsole,
    hasPreviewableFiles,
  };
}
