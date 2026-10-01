import Image from "next/image";
import Link from "next/link";

interface BrandProps {
  /** Mark size in px. */
  size?: number;
  /** Render as a link to this href; null renders a plain span. */
  href?: string | null;
  /** Accessible label for the link variant. */
  label?: string;
  /** "white" mark for use on gradient or colored backgrounds. */
  tone?: "color" | "white";
}

/**
 * PlusOne brand lockup: the official +/1 mark SVG (pink → purple → blue
 * gradient) plus the "PLUSONE" wordmark in Poppins 600.
 */
export function Brand({
  size = 30,
  href = "/",
  label = "PlusOne home",
  tone = "color",
}: BrandProps) {
  const mark = (
    <>
      <Image
        src={
          tone === "white"
            ? "/brand/plusone-mark-white.svg"
            : "/brand/plusone-mark.svg"
        }
        alt=""
        width={size}
        height={size}
        className="po-brand-img"
        aria-hidden="true"
        priority={false}
      />
      <span className="po-brand-word">PLUSONE</span>
    </>
  );

  if (href === null) {
    return (
      <span className="po-brand" aria-label="PlusOne">
        {mark}
      </span>
    );
  }

  return (
    <Link href={href} className="po-brand" aria-label={label}>
      {mark}
    </Link>
  );
}
