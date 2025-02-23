export default function FaceGuide() {
  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 300"
      style={{ zIndex: 1 }}
    >
      {/* Óvalo guía */}
      <ellipse
        cx="200"
        cy="150"
        rx="80"
        ry="100"
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="2"
        strokeDasharray="10,5"
      />
    </svg>
  );
} 