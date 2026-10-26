import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Assessment, Block } from "./assessmentTypes";

export default function AssessmentMap({
  result,
  onSelect,
}: {
  result: Assessment;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const selected = useRef(onSelect);
  selected.current = onSelect;
  useEffect(() => {
    if (!host.current) return;
    const { latitude, longitude, bounds } = result.parameters;
    const map = L.map(host.current, { scrollWheelZoom: false }).setView(
      [latitude, longitude],
      14,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    if (bounds) {
      const area = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      );
      L.imageOverlay(`data:image/png;base64,${result.overlays.heatmap}`, area, {
        opacity: 0.75,
      }).addTo(map);
      result.blocks.forEach((block: Block) => {
        if (!block.bounds) return;
        const b = block.bounds;
        L.rectangle(
          [
            [b.south, b.west],
            [b.north, b.east],
          ],
          { color: block.color, weight: 1.5, fillOpacity: 0.15 },
        )
          .bindTooltip(
            `${block.id} · ${block.status} · ${block.score.toFixed(1)}/100`,
          )
          .on("click", () => selected.current(block.id))
          .addTo(map);
      });
      map.fitBounds(area, { padding: [25, 25] });
    } else {
      L.circleMarker([latitude, longitude], {
        radius: 9,
        fillColor: "#159b91",
        color: "#fff",
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip(
          "Weather query location; image blocks are not georeferenced",
        )
        .addTo(map);
    }
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      map.remove();
    };
  }, [result.id]);
  return (
    <div
      ref={host}
      className="geo-map"
      aria-label="Geographic mine location and optional surveyed image blocks"
    />
  );
}
