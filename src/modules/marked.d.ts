// Type definitions for marked
declare module 'marked' {
  interface MarkedOptions {
    renderer?: Renderer;
    gfm?: boolean;
    tables?: boolean;
    breaks?: boolean;
    pedantic?: boolean;
    sanitize?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
  }

  interface RendererOptions {
    code?: (code: string, lang: string) => string;
    paragraph?: (text: string) => string;
    heading?: (text: string, level: number) => string;
    list?: (body: string, ordered: boolean, items: any) => string;
    listitem?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    image?: (href: string, title: string, text: string) => string;
    br?: () => string;
    hr?: () => string;
    table?: (header: string, body: string) => string;
    tablerow?: (content: string) => string;
    tablecell?: (content: string, flags: { header: boolean, align: string }) => string;
  }

  interface Renderer {
    code: (token: { text: string; lang?: string }) => string;
    paragraph: (token: { text: string | any }) => string;
    heading: (token: { text: string; depth: number }) => string;
    list: (token: { items: string; ordered: boolean }) => string;
    listitem: (token: { text: string | any }) => string;
    link: (token: { href: string; title: string; text: string }) => string;
  }

  function marked(src: string, opt?: MarkedOptions): string;
  namespace marked {
    function use(options: { renderer: Partial<Renderer> }): typeof marked;
  }

  export = marked;
}