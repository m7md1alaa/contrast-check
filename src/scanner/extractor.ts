export interface ExtractedPair {
  text: string;
  tag: string;
  color: string;
  background: string;
  selector: string;
  xpath: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  fontSize: string;
  fontWeight: string;
  isVisible: boolean;
  colorVar?: string;
  bgVar?: string;
}

export function createExtractorScript() {
  return function extractFromPage(): ExtractedPair[] {
    function getXPath(element: Element): string {
      if (element.id) return `//*[@id="${element.id}"]`;
      if (element === document.body) return '/html/body';
      let ix = 0;
      const siblings = element.parentNode?.children;
      if (!siblings) return '';
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling && sibling === element) {
          return getXPath(element.parentElement!) + '/' + element.tagName.toLowerCase() + `[${ix + 1}]`;
        }
        if (sibling && sibling.tagName === element.tagName) ix++;
      }
      return '';
    }

    function getSelector(element: Element): string {
      if (element.id) return `#${element.id}`;
      let path = '';
      let curr: Element | null = element;
      while (curr && curr !== document.body) {
        let selector = curr.tagName.toLowerCase();
        if (curr.className) {
          const classes = curr.className.toString().split(/\s+/).filter(c => c);
          if (classes.length) selector += '.' + classes.join('.');
        }
        const parentEl: Element | null = curr.parentElement;
        if (parentEl) {
          const siblings = Array.from(parentEl.children).filter((s) => (s as Element).tagName === curr!.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(curr as any) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }
        path = selector + (path ? ' > ' + path : '');
        curr = parentEl;
      }
      return path || element.tagName.toLowerCase();
    }

    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (parseFloat(style.opacity) === 0) return false;
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    }

    function resolveBackgroundColor(el: Element | null): string {
      if (!el || el === document.documentElement) {
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        if (htmlBg && htmlBg !== 'rgba(0, 0, 0, 0)' && htmlBg !== 'transparent') return htmlBg;
        return 'rgb(255, 255, 255)';
      }

      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;

      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        return bg;
      }

      // Check for background image/gradient
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        return `image:${bgImage}`;
      }

      return resolveBackgroundColor(el.parentElement);
    }

    // ── CSS Variable extraction ──
    interface VarInfo {
      varName: string;
      rawValue: string;
    }

    function extractVariableMap(): Map<string, VarInfo> {
      const map = new Map<string, VarInfo>();
      const varNames = new Set<string>();

      // Collect all custom property names from stylesheets
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          const rules = (sheet as any).cssRules || (sheet as any).rules;
          if (!rules) continue;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule && (rule as any).style) {
              const style = (rule as any).style;
              for (let k = 0; k < style.length; k++) {
                const prop = style[k];
                if (prop && prop.startsWith('--')) varNames.add(prop);
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
        }
      }

      // Also collect from inline styles on documentElement and body
      const collectInline = (el: Element) => {
        const style = el.getAttribute('style');
        if (style) {
          const matches = style.match(/--[\w-]+/g);
          if (matches) matches.forEach(v => varNames.add(v));
        }
      };
      collectInline(document.documentElement);
      collectInline(document.body);

      // Resolve each variable to a computed color using a temp element
      const temp = document.createElement('div');
      temp.style.position = 'absolute';
      temp.style.visibility = 'hidden';
      document.body.appendChild(temp);

      for (const varName of varNames) {
        const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        if (!rawValue) continue;

        // Try as color
        temp.style.color = '';
        temp.style.color = `var(${varName})`;
        const resolvedColor = window.getComputedStyle(temp).color;
        if (resolvedColor && resolvedColor !== 'rgba(0, 0, 0, 0)' && resolvedColor !== 'transparent') {
          const existing = map.get(resolvedColor);
          // Prefer shorter names (more canonical) when colors collide
          if (!existing || varName.length < existing.varName.length) {
            map.set(resolvedColor, { varName, rawValue });
          }
        }

        // Try as background color too
        temp.style.backgroundColor = '';
        temp.style.backgroundColor = `var(${varName})`;
        const resolvedBg = window.getComputedStyle(temp).backgroundColor;
        if (resolvedBg && resolvedBg !== 'rgba(0, 0, 0, 0)' && resolvedBg !== 'transparent') {
          const existing = map.get(resolvedBg);
          if (!existing || varName.length < existing.varName.length) {
            map.set(resolvedBg, { varName, rawValue });
          }
        }
      }

      document.body.removeChild(temp);
      return map;
    }

    const variableMap = extractVariableMap();

    const pairs: ExtractedPair[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const seen = new Set<string>();

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const text = textNode.textContent?.trim();
      if (!text || text.length === 0) continue;

      const element = textNode.parentElement;
      if (!element) continue;

      // Skip script/style tags
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) continue;

      const style = window.getComputedStyle(element);
      const color = style.color;
      const background = resolveBackgroundColor(element);

      // Deduplicate by text + color + background + selector to reduce noise
      const key = `${text}|${color}|${background}|${element.tagName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const rect = element.getBoundingClientRect();
      const fontSize = style.fontSize;
      const fontWeight = style.fontWeight;
      const visible = isVisible(element);

      // Match computed colors to CSS variables
      const colorVar = variableMap.get(color)?.varName;
      const bgVar = variableMap.get(background)?.varName;

      pairs.push({
        text: text.length > 100 ? text.slice(0, 100) + '...' : text,
        tag: element.tagName.toLowerCase(),
        color,
        background,
        selector: getSelector(element),
        xpath: getXPath(element),
        boundingRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        fontSize,
        fontWeight,
        isVisible: visible,
        colorVar,
        bgVar,
      });
    }

    return pairs;
  };
}
