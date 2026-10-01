const C = 160;
const SPOKES = Array.from({ length: 24 }, (_, i) => i * 15);

const ORBITS = [
  { label: "Women & Child", r: 104, a: 0, dur: 46 },
  { label: "Healthcare", r: 86, a: 60, dur: 36 },
  { label: "Education", r: 104, a: 120, dur: 54 },
  { label: "Agriculture", r: 86, a: 180, dur: 40 },
  { label: "Housing", r: 104, a: 240, dur: 50 },
  { label: "Pension", r: 86, a: 300, dur: 32 },
];

const rad = (deg) => (deg * Math.PI) / 180;
const orbitX = (r, a) => C + r * Math.sin(rad(a));
const orbitY = (r, a) => C - r * Math.cos(rad(a));

const Chakra = ({ className = "" }) => (
  <svg
    className={`chakra ${className}`.trim()}
    viewBox="0 0 320 320"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    {/* orbit paths */}
    <circle cx={C} cy={C} r="104" stroke="currentColor" strokeWidth="0.7" opacity="0.22" />
    <circle cx={C} cy={C} r="86" stroke="currentColor" strokeWidth="0.7" opacity="0.16" />

    {/* chakra wheel */}
    <g className="chakra__wheel">
      <circle cx={C} cy={C} r="64" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
      <circle cx={C} cy={C} r="50" stroke="currentColor" strokeWidth="0.7" opacity="0.26" />
      {SPOKES.map((a) => (
        <line
          key={a}
          x1={C}
          y1={C - 64}
          x2={C}
          y2={C - 50}
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.42"
          transform={`rotate(${a} ${C} ${C})`}
        />
      ))}
      <circle cx={C} cy={C} r="10" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
      <circle cx={C} cy={C} r="3" fill="currentColor" />
    </g>

    {/* revolving scheme categories — positioned by trig so labels stay upright */}
    {ORBITS.map((o) => {
      const x = orbitX(o.r, o.a);
      const y = orbitY(o.r, o.a);
      return (
        <g
          key={o.label}
          className="chakra__orbit"
          style={{ animationDuration: `${o.dur}s` }}
        >
          <circle cx={x} cy={y} r="2.8" className="chakra__dot" />
          <g className="chakra__label" style={{ animationDuration: `${o.dur}s` }}>
            <rect
              x={x - (o.label.length * 2.8 + 9)}
              y={y - 20}
              width={o.label.length * 5.6 + 18}
              height="17"
              rx="8.5"
              className="chakra__label-bg"
            />
            <text x={x} y={y - 8} textAnchor="middle">
              {o.label}
            </text>
          </g>
        </g>
      );
    })}
  </svg>
);

export default Chakra;
