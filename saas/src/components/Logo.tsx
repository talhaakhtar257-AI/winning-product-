export function Logo({ url, name }: { url?: string; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={30} height={30} />;
  }
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <title>{name}</title>
      <circle cx="17" cy="17" r="16" fill="var(--brand)" />
      <circle cx="17" cy="17" r="10.5" fill="none" stroke="#F4F6F2" strokeOpacity=".25" />
      <circle cx="17" cy="17" r="5" fill="none" stroke="#F4F6F2" strokeOpacity=".25" />
      <path d="M17 17 L17 1 A16 16 0 0 1 32 12 Z" fill="var(--accent)" opacity=".85" />
      <circle cx="23" cy="10" r="2.2" fill="#F4F6F2" />
    </svg>
  );
}
