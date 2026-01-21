"use client";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        "rounded border px-3 py-2 text-sm",
        rest.disabled ? "opacity-50" : "hover:bg-gray-50",
        className ?? "",
      ].join(" ")}
    />
  );
}
