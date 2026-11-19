type Pattern = "none" | "code" | "qr";

/**
 * A small isometric slab drawn from three faces, so the protocol steps and the
 * closing band can show real objects instead of flat icons. Pure SVG: no
 * images, no dependency, scales crisply at any size.
 */
export function IsoBlock({
  className = "",
  width = 84,
  height = 46,
  depth = 13,
  pattern = "none",
  packet = false,
  tone = "light",
}: {
  className?: string;
  width?: number;
  height?: number;
  depth?: number;
  pattern?: Pattern;
  packet?: boolean;
  tone?: "light" | "ink";
}) {
  const cx = 60;
  const cy = 34;
  const hw = width / 2;
  const hh = height / 2;

  const points = (p: Array<[number, number]>) =>
    p.map(([x, y]) => `${x},${y}`).join(" ");

  const top: Array<[number, number]> = [
    [cx, cy - hh],
    [cx + hw, cy],
    [cx, cy + hh],
    [cx - hw, cy],
  ];
  const left: Array<[number, number]> = [
    [cx - hw, cy],
    [cx, cy + hh],
    [cx, cy + hh + depth],
    [cx - hw, cy + depth],
  ];
  const right: Array<[number, number]> = [
    [cx + hw, cy],
    [cx, cy + hh],
    [cx, cy + hh + depth],
    [cx + hw, cy + depth],
  ];

  const cells: Array<[number, number]> =
    pattern === "qr"
      ? [-1, 0, 1].flatMap((i) =>
          [-1, 0, 1].map((j) => [i, j] as [number, number]),
        )
      : pattern === "code"
        ? [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ]
        : [];

  const size = pattern === "qr" ? 4 : 6;

  const tones =
    tone === "light"
      ? {
          top: "#ffd400",
          left: "rgba(247,246,238,0.28)",
          right: "rgba(247,246,238,0.12)",
          cell: "#0d0d0a",
          packet: "#ffd400",
        }
      : {
          top: "rgba(20,20,12,0.28)",
          left: "rgba(20,20,12,0.14)",
          right: "rgba(20,20,12,0.07)",
          cell: "#ffd400",
          packet: "rgba(20,20,12,0.75)",
        };

  const packetX = cx;
  const packetY = cy - hh - 16;

  return (
    <svg
      viewBox="-10 -12 140 112"
      className={className}
      aria-hidden
      fill="none"
    >
      <polygon points={points(left)} fill={tones.left} />
      <polygon points={points(right)} fill={tones.right} />
      <polygon points={points(top)} fill={tones.top} />

      {cells.map(([i, j]) => {
        const x = cx + (i / 3) * hw + (j / 3) * -hw;
        const y = cy + (i / 3) * hh + (j / 3) * hh;
        return (
          <polygon
            key={`${i}:${j}`}
            points={`${x},${y - size / 2} ${x + size},${y} ${x},${y + size / 2} ${x - size},${y}`}
            fill={tones.cell}
          />
        );
      })}

      {packet ? (
        <g>
          <line
            x1={packetX}
            y1={packetY + 5}
            x2={packetX}
            y2={cy - hh - 2}
            stroke="#ffd400"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="2 2.5"
          />
          <polygon
            points={`${packetX},${packetY - 5} ${packetX + 5},${packetY - 2.5} ${packetX},${packetY} ${packetX - 5},${packetY - 2.5}`}
            fill={tones.packet}
          />
          <polygon
            points={`${packetX - 5},${packetY - 2.5} ${packetX},${packetY} ${packetX},${packetY + 5} ${packetX - 5},${packetY + 2.5}`}
            fill={tones.packet}
            opacity="0.6"
          />
          <polygon
            points={`${packetX + 5},${packetY - 2.5} ${packetX},${packetY} ${packetX},${packetY + 5} ${packetX + 5},${packetY + 2.5}`}
            fill={tones.packet}
            opacity="0.35"
          />
        </g>
      ) : null}
    </svg>
  );
}
