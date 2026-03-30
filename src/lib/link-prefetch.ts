export function getLinkPrefetch(href: string) {
  return href.startsWith("/api/") ? false : undefined;
}
