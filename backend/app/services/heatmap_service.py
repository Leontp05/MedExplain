"""Gaze heatmap aggregation with visit counting + explanation markers."""

from collections import defaultdict
from datetime import datetime

from app.schemas import HeatmapPoint, HeatmapResponse


def _cluster_visits(
    gaze_data: list[tuple[float, float, int, datetime]],
    spatial_threshold: float = 0.06,
    temporal_gap_ms: int = 3000,
) -> list[dict]:
    """Group gaze points into discrete 'visits'.

    A visit = a continuous dwell session where points are within
    spatial_threshold (6% of page) and consecutive points are within
    temporal_gap_ms (3 seconds) of each other. If the user looks away
    and comes back, that's 2 visits.
    """
    if not gaze_data:
        return []

    # Sort by recorded_at (timestamp)
    sorted_data = sorted(gaze_data, key=lambda d: d[3])

    visits = []
    current_visit = {
        "x_sum": sorted_data[0][0],
        "y_sum": sorted_data[0][1],
        "count": 1,
        "duration_ms": sorted_data[0][2],
        "centroid_x": sorted_data[0][0],
        "centroid_y": sorted_data[0][1],
        "start_time": sorted_data[0][3],
    }

    for i in range(1, len(sorted_data)):
        x, y, dur, ts = sorted_data[i]
        prev_ts = sorted_data[i - 1][3]
        time_gap = (ts - prev_ts).total_seconds() * 1000

        spatial_dist = (
            (x - current_visit["centroid_x"]) ** 2
            + (y - current_visit["centroid_y"]) ** 2
        ) ** 0.5

        if time_gap > temporal_gap_ms or spatial_dist > spatial_threshold:
            # New visit — finalize the current one
            visits.append(current_visit)
            current_visit = {
                "x_sum": x,
                "y_sum": y,
                "count": 1,
                "duration_ms": dur,
                "centroid_x": x,
                "centroid_y": y,
                "start_time": ts,
            }
        else:
            # Continue current visit
            current_visit["x_sum"] += x
            current_visit["y_sum"] += y
            current_visit["count"] += 1
            current_visit["duration_ms"] += dur
            current_visit["centroid_x"] = current_visit["x_sum"] / current_visit["count"]
            current_visit["centroid_y"] = current_visit["y_sum"] / current_visit["count"]

    visits.append(current_visit)
    return visits


def _cluster_hotspots(visits: list[dict], threshold: float = 0.08) -> list[dict]:
    """Cluster nearby visits into hotspots.

    Visits within threshold (8% of page) of each other get merged into
    a single hotspot. The hotspot's visit_count = number of merged visits.
    """
    if not visits:
        return []

    hotspots = []
    assigned = [False] * len(visits)

    for i, visit in enumerate(visits):
        if assigned[i]:
            continue

        cluster = [visit]
        assigned[i] = True
        cx, cy = visit["centroid_x"], visit["centroid_y"]

        for j in range(i + 1, len(visits)):
            if assigned[j]:
                continue
            dist = ((visits[j]["centroid_x"] - cx) ** 2 + (visits[j]["centroid_y"] - cy) ** 2) ** 0.5
            if dist <= threshold:
                cluster.append(visits[j])
                assigned[j] = True
                # Update centroid to cluster average
                cx = sum(v["centroid_x"] for v in cluster) / len(cluster)
                cy = sum(v["centroid_y"] for v in cluster) / len(cluster)

        total_duration = sum(v["duration_ms"] for v in cluster)
        avg_x = sum(v["centroid_x"] for v in cluster) / len(cluster)
        avg_y = sum(v["centroid_y"] for v in cluster) / len(cluster)

        hotspots.append({
            "x": avg_x,
            "y": avg_y,
            "visits": len(cluster),
            "total_duration_ms": total_duration,
        })

    return hotspots


def generate_heatmap(
    gaze_data: list[tuple[float, float, int, datetime]],
) -> list[HeatmapPoint]:
    """Generate heatmap points with visit-count-based intensity.

    Returns points where:
      - intensity = normalized visit count (0.0 to 1.0)
      - visits = raw visit count (1, 2, 3, ...)
    """
    if not gaze_data:
        return []

    visits = _cluster_visits(gaze_data)
    hotspots = _cluster_hotspots(visits)

    if not hotspots:
        return []

    max_visits = max(h["visits"] for h in hotspots) or 1

    points = []
    for h in hotspots:
        points.append(
            HeatmapPoint(
                x=h["x"],
                y=h["y"],
                intensity=h["visits"] / max_visits,
                visits=h["visits"],
                duration_ms=h["total_duration_ms"],
            )
        )
    return points


def build_heatmap_response(
    page_number: int,
    gaze_data: list[tuple[float, float, int, datetime]],
    explanations: list[dict] | None = None,
) -> HeatmapResponse:
    """Build heatmap response with viewed hotspots + explanation markers."""
    points = generate_heatmap(gaze_data)

    explanation_points = []
    if explanations:
        for ex in explanations:
            if ex.get("region_bounds"):
                bounds = ex["region_bounds"]
                explanation_points.append({
                    "x": bounds["x"] + bounds["width"] / 2,
                    "y": bounds["y"] + bounds["height"] / 2,
                    "region_text": ex.get("region_text", ""),
                })

    return HeatmapResponse(
        page_number=page_number,
        points=points,
        explanation_points=explanation_points,
    )