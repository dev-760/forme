import React from "react";

export function FormeMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/forme-icon.svg"
      alt="FORME Icon"
      width={size}
      height={size}
      className={`forme-mark-svg ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.26)}px`,
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}

export function FormeBrand({
  large = false,
  subtitle = "ATELIER",
}: {
  large?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={`forme-brand-lockup ${large ? "is-large" : ""}`}>
      <FormeMark size={large ? 44 : 32} />
      <span className="forme-brand-text">
        <span className="forme-brand-name">FORME</span>
        {subtitle && <span className="forme-brand-sub">{subtitle}</span>}
      </span>
    </span>
  );
}
