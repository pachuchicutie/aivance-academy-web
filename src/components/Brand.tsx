type BrandProps = {
  href?: string;
};

export default function Brand({ href = "#home" }: BrandProps) {
  return (
    <a href={href} className="brand" aria-label="AIvanza Academy | home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.webp" alt="AIvanza Academy logo" />
      <span>
        <span className="brand-name">
          AI<span>vanza</span>
        </span>
        <span className="brand-sub">Academy</span>
      </span>
    </a>
  );
}
