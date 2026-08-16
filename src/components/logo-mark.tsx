export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-black font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      N
    </div>
  );
}
