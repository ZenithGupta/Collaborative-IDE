// Type declarations for Prettier standalone browser modules used via dynamic import()
declare module 'prettier/standalone' {
  export function format(source: string, options?: any): Promise<string>;
  export function check(source: string, options?: any): Promise<boolean>;
}

declare module 'prettier/plugins/estree' {
  const plugin: any;
  export default plugin;
}

declare module 'prettier/plugins/babel' {
  const plugin: any;
  export default plugin;
}

declare module 'prettier/plugins/typescript' {
  const plugin: any;
  export default plugin;
}

declare module 'prettier/plugins/html' {
  const plugin: any;
  export default plugin;
}

declare module 'prettier/plugins/postcss' {
  const plugin: any;
  export default plugin;
}

declare module 'prettier/plugins/markdown' {
  const plugin: any;
  export default plugin;
}
