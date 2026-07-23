"""Statistics computation and doctor report generation for menstruation gauge."""

from __future__ import annotations

import html
from collections import Counter
from datetime import date, timedelta
from statistics import mean, stdev
from typing import Any

from .model import bleeding_blocks, grouped_cycle_starts, normalize_history


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_iso(value: Any) -> date | None:
    """Safely parse an ISO date string."""
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _symptom_entries_in_range(
    symptom_history: list[dict[str, Any]],
    start: date,
    end: date,
) -> list[dict[str, Any]]:
    """Return symptom entries whose date falls in [start, end]."""
    result = []
    for entry in symptom_history:
        d = _parse_iso(entry.get("date"))
        if d is not None and start <= d <= end:
            result.append(entry)
    return result


def _coerce_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str) and value:
        return [value]
    return []


# ---------------------------------------------------------------------------
# Statistics computation
# ---------------------------------------------------------------------------

def _compute_cycle_length_stats(
    grouped_starts: list[str],
    cutoff: date,
) -> dict[str, Any]:
    """Compute cycle length statistics for completed cycles since cutoff."""
    valid_starts = [s for s in grouped_starts if _parse_iso(s) is not None]
    lengths: list[int] = []
    for i in range(1, len(valid_starts)):
        s0 = _parse_iso(valid_starts[i - 1])
        s1 = _parse_iso(valid_starts[i])
        if s0 is None or s1 is None:
            continue
        if s0 < cutoff:
            continue
        length = (s1 - s0).days
        if 10 < length < 80:
            lengths.append(length)

    if not lengths:
        return {"cycles_analyzed": 0}

    avg = round(mean(lengths), 1)
    std = round(stdev(lengths), 1) if len(lengths) >= 2 else 0.0

    regularity: str
    if std <= 2:
        regularity = "very_regular"
    elif std <= 5:
        regularity = "regular"
    else:
        regularity = "irregular"

    return {
        "cycles_analyzed": len(lengths),
        "avg_cycle_length": avg,
        "min_cycle_length": min(lengths),
        "max_cycle_length": max(lengths),
        "std_cycle_length": std,
        "regularity": regularity,
        "cycle_lengths": lengths,
    }


def _build_cycle_periods(
    grouped_starts: list[str],
    cutoff: date,
    today: date,
) -> list[tuple[date, date, str]]:
    """Build (start, end, start_iso) tuples for cycles since cutoff."""
    periods: list[tuple[date, date, str]] = []
    valid = [s for s in grouped_starts if _parse_iso(s) is not None]
    for i, start_iso in enumerate(valid):
        start_d = _parse_iso(start_iso)
        if start_d is None or start_d < cutoff:
            continue
        if i + 1 < len(valid):
            next_d = _parse_iso(valid[i + 1])
            if next_d is None:
                continue
            end_d = min(today, next_d - timedelta(days=1))
        else:
            end_d = today
        if end_d >= start_d:
            periods.append((start_d, end_d, start_iso))
    return periods


def _compute_bleeding_duration_stats(
    history: list[str],
    cutoff: date,
) -> dict[str, Any]:
    """Compute bleeding duration statistics from the raw history."""
    blocks = bleeding_blocks(history)
    durations: list[int] = []
    for block in blocks:
        dates = sorted(_parse_iso(d) for d in block if _parse_iso(d) is not None)  # type: ignore[type-var]
        if not dates:
            continue
        first = dates[0]
        if first < cutoff:
            continue
        last = dates[-1]
        durations.append((last - first).days + 1)

    if not durations:
        return {}

    return {
        "avg_bleeding_duration": round(mean(durations), 1),
        "min_bleeding_duration": min(durations),
        "max_bleeding_duration": max(durations),
    }


def _compute_symptom_stats(
    symptom_history: list[dict[str, Any]],
    periods: list[tuple[date, date, str]],
) -> dict[str, Any]:
    """Compute symptom statistics across the given cycle periods."""
    if not periods:
        return {}

    symptom_counter: Counter[str] = Counter()
    pain_per_cycle: list[float] = []
    bleeding_strength_counter: Counter[str] = Counter()

    multi_keys = ("pain", "hygiene", "test")

    for start_d, end_d, _ in periods:
        entries = _symptom_entries_in_range(symptom_history, start_d, end_d)
        cycle_pain_days = 0
        for entry in entries:
            pain = _coerce_list(entry.get("pain"))
            if pain:
                cycle_pain_days += 1
                for p in pain:
                    symptom_counter[f"pain:{p}"] += 1

            bleeding = entry.get("bleeding_strength")
            if isinstance(bleeding, str) and bleeding:
                bleeding_strength_counter[bleeding] += 1

            for key in ("spotting", "discharge", "intercourse", "cervical_mucus"):
                val = entry.get(key)
                if isinstance(val, str) and val:
                    symptom_counter[f"{key}:{val}"] += 1

            for key in multi_keys:
                if key == "pain":
                    continue
                vals = _coerce_list(entry.get(key))
                for v in vals:
                    symptom_counter[f"{key}:{v}"] += 1

        pain_per_cycle.append(cycle_pain_days)

    total_cycles = len(periods)
    top_symptoms = [
        {"key": key, "count": count, "pct": round(count / total_cycles * 100)}
        for key, count in symptom_counter.most_common(5)
    ] if total_cycles else []

    bleeding_total = sum(bleeding_strength_counter.values())
    bleeding_distribution = {
        k: round(v / bleeding_total * 100)
        for k, v in bleeding_strength_counter.items()
    } if bleeding_total else {}

    avg_pain_days = round(mean(pain_per_cycle), 1) if pain_per_cycle else 0.0

    return {
        "top_symptoms": top_symptoms,
        "bleeding_strength_distribution": bleeding_distribution,
        "avg_pain_days_per_cycle": avg_pain_days,
    }


def _compute_pain_trend(
    symptom_history: list[dict[str, Any]],
    periods: list[tuple[date, date, str]],
) -> list[dict[str, Any]]:
    """Compute pain day count per cycle for trend charts."""
    trend: list[dict[str, Any]] = []
    for start_d, end_d, start_iso in periods:
        entries = _symptom_entries_in_range(symptom_history, start_d, end_d)
        pain_days = sum(1 for e in entries if _coerce_list(e.get("pain")))
        trend.append({"cycle_start": start_iso, "pain_days": pain_days})
    return trend


def compute_statistics(
    history: list[str],
    symptom_history: list[dict[str, Any]],
    days_back: int = 180,
) -> dict[str, Any]:
    """Compute comprehensive cycle statistics for the given look-back period."""
    today = date.today()
    cutoff = today - timedelta(days=max(1, days_back))

    normalized = normalize_history(history)
    usable = [h for h in normalized if _parse_iso(h) is not None and _parse_iso(h) <= today]  # type: ignore[operator]

    starts = grouped_cycle_starts(usable)
    cycle_stats = _compute_cycle_length_stats(starts, cutoff)
    bleeding_stats = _compute_bleeding_duration_stats(usable, cutoff)

    periods = _build_cycle_periods(starts, cutoff, today)
    symptom_stats = _compute_symptom_stats(symptom_history, periods)
    pain_trend = _compute_pain_trend(symptom_history, periods)

    return {
        **cycle_stats,
        **bleeding_stats,
        **symptom_stats,
        "pain_trend": pain_trend,
        "days_back": days_back,
        "report_date": today.isoformat(),
    }


# ---------------------------------------------------------------------------
# HTML report generation (for doctor export)
# ---------------------------------------------------------------------------

_REGULARITY_LABELS: dict[str, dict[str, str]] = {
    "very_regular": {"de": "Sehr regelmäßig", "en": "Very regular"},
    "regular": {"de": "Regelmäßig", "en": "Regular"},
    "irregular": {"de": "Unregelmäßig", "en": "Irregular"},
}

_BLEEDING_STRENGTH_LABELS: dict[str, dict[str, str]] = {
    "none": {"de": "Keine", "en": "None"},
    "keine": {"de": "Keine", "en": "None"},
    "light": {"de": "Leicht", "en": "Light"},
    "medium": {"de": "Normal", "en": "Medium"},
    "heavy": {"de": "Stark", "en": "Heavy"},
    "very_heavy": {"de": "Sehr stark", "en": "Very heavy"},
}

_SYMPTOM_KEY_LABELS: dict[str, dict[str, str]] = {
    "pain:cramps": {"de": "Krämpfe", "en": "Cramps"},
    "pain:mittelschmerz": {"de": "Mittelschmerz", "en": "Mittelschmerz"},
    "pain:tender_breasts": {"de": "Brustspannen", "en": "Tender breasts"},
    "pain:headache": {"de": "Kopfschmerzen", "en": "Headache"},
    "pain:migraine": {"de": "Migräne", "en": "Migraine"},
    "pain:lower_back": {"de": "Rückenschmerzen", "en": "Lower back pain"},
    "pain:vulva": {"de": "Vulvaschmerzen", "en": "Vulva pain"},
    "spotting:red": {"de": "Schmierblutung (rot)", "en": "Spotting (red)"},
    "spotting:brown": {"de": "Schmierblutung (braun)", "en": "Spotting (brown)"},
    "hygiene:tampon": {"de": "Tampon", "en": "Tampon"},
    "hygiene:pad": {"de": "Binde", "en": "Pad"},
    "hygiene:cup": {"de": "Menstruationstasse", "en": "Cup"},
    "hygiene:liner": {"de": "Slipeinlage", "en": "Liner"},
    "hygiene:period_underwear": {"de": "Periodenunterwäsche", "en": "Period underwear"},
    "intercourse:protected": {"de": "Geschützter GV", "en": "Protected intercourse"},
    "intercourse:unprotected": {"de": "Ungeschützter GV", "en": "Unprotected intercourse"},
}


def _label(key: str, labels_map: dict[str, dict[str, str]], lang: str, fallback: str | None = None) -> str:
    entry = labels_map.get(key)
    if entry:
        return entry.get(lang) or entry.get("en") or key
    return fallback or key.replace("_", " ").title()


def _h(text: Any) -> str:
    return html.escape(str(text))


def generate_doctor_report_html(
    stats: dict[str, Any],
    history: list[str],
    symptom_history: list[dict[str, Any]],
    profile: str,
    patient_name: str | None,
    patient_birthdate: str | None,
    language: str = "de",
    report_date: str | None = None,
) -> str:
    """Generate a professional HTML doctor report from computed statistics."""
    lang = "de" if language.lower().startswith("de") else "en"
    today_str = report_date or date.today().isoformat()
    days_back = stats.get("days_back", 180)
    cycles_analyzed = stats.get("cycles_analyzed", 0)

    # Translations
    T: dict[str, str]
    if lang == "de":
        T = {
            "title": "Menstruationszyklus-Bericht",
            "subtitle": "Medizinischer Bericht",
            "patient_info": "Patientendaten",
            "patient_name": "Name",
            "patient_birthdate": "Geburtsdatum",
            "report_date": "Berichtsdatum",
            "profile": "Profil",
            "period": f"Analysierter Zeitraum: letzte {days_back} Tage",
            "cycles": f"Analysierte Zyklen: {cycles_analyzed}",
            "cycle_length": "Zykluslänge",
            "avg": "Ø",
            "min": "Min",
            "max": "Max",
            "std": "Stabw.",
            "days": "Tage",
            "regularity": "Regelmäßigkeit",
            "bleeding_duration": "Blutungsdauer",
            "bleeding_strength": "Blutungsstärke-Verteilung",
            "top_symptoms": "Häufigste Symptome (Häufigkeit)",
            "pain_trend": "Schmerztage pro Zyklus (Trend)",
            "cycle_start": "Zyklusbeginn",
            "pain_days": "Schmerztage",
            "cycle_data": "Zyklusdaten",
            "date": "Datum",
            "no_data": "Keine Daten vorhanden",
            "footer": "Dieser Bericht wurde automatisch von der Menstruation Gauge Integration (Home Assistant) erstellt.",
            "avg_pain_days": "Ø Schmerztage/Zyklus",
        }
    else:
        T = {
            "title": "Menstrual Cycle Report",
            "subtitle": "Medical Report",
            "patient_info": "Patient Information",
            "patient_name": "Name",
            "patient_birthdate": "Date of Birth",
            "report_date": "Report Date",
            "profile": "Profile",
            "period": f"Analysis period: last {days_back} days",
            "cycles": f"Cycles analyzed: {cycles_analyzed}",
            "cycle_length": "Cycle Length",
            "avg": "Avg",
            "min": "Min",
            "max": "Max",
            "std": "Std Dev",
            "days": "days",
            "regularity": "Regularity",
            "bleeding_duration": "Bleeding Duration",
            "bleeding_strength": "Bleeding Strength Distribution",
            "top_symptoms": "Top Symptoms (frequency)",
            "pain_trend": "Pain Days per Cycle (Trend)",
            "cycle_start": "Cycle Start",
            "pain_days": "Pain Days",
            "cycle_data": "Cycle Data",
            "date": "Date",
            "no_data": "No data available",
            "footer": "This report was automatically generated by the Menstruation Gauge integration (Home Assistant).",
            "avg_pain_days": "Avg pain days/cycle",
        }

    # Patient info section
    patient_section = ""
    if patient_name or patient_birthdate:
        rows = ""
        if patient_name:
            rows += f"<tr><td>{_h(T['patient_name'])}</td><td>{_h(patient_name)}</td></tr>"
        if patient_birthdate:
            rows += f"<tr><td>{_h(T['patient_birthdate'])}</td><td>{_h(patient_birthdate)}</td></tr>"
        patient_section = f"""
        <section class="section">
          <h2>{_h(T['patient_info'])}</h2>
          <table class="info-table"><tbody>{rows}</tbody></table>
        </section>"""

    # Cycle length stats
    cycle_length_html = T["no_data"]
    if cycles_analyzed > 0:
        avg = stats.get("avg_cycle_length", "–")
        mn = stats.get("min_cycle_length", "–")
        mx = stats.get("max_cycle_length", "–")
        std = stats.get("std_cycle_length", "–")
        regularity_key = stats.get("regularity", "")
        regularity_label = _label(regularity_key, _REGULARITY_LABELS, lang)
        cycle_length_html = f"""
        <table class="stats-table">
          <tr><th>{_h(T['avg'])}</th><th>{_h(T['min'])}</th><th>{_h(T['max'])}</th><th>{_h(T['std'])}</th><th>{_h(T['regularity'])}</th></tr>
          <tr>
            <td>{avg} {_h(T['days'])}</td>
            <td>{mn} {_h(T['days'])}</td>
            <td>{mx} {_h(T['days'])}</td>
            <td>{std} {_h(T['days'])}</td>
            <td>{_h(regularity_label)}</td>
          </tr>
        </table>"""

    # Bleeding duration
    bleeding_dur_html = T["no_data"]
    if stats.get("avg_bleeding_duration") is not None:
        avg_b = stats.get("avg_bleeding_duration", "–")
        mn_b = stats.get("min_bleeding_duration", "–")
        mx_b = stats.get("max_bleeding_duration", "–")
        bleeding_dur_html = f"""
        <table class="stats-table">
          <tr><th>{_h(T['avg'])}</th><th>{_h(T['min'])}</th><th>{_h(T['max'])}</th></tr>
          <tr>
            <td>{avg_b} {_h(T['days'])}</td>
            <td>{mn_b} {_h(T['days'])}</td>
            <td>{mx_b} {_h(T['days'])}</td>
          </tr>
        </table>"""

    # Bleeding strength distribution
    dist = stats.get("bleeding_strength_distribution", {})
    bs_rows = ""
    for k, pct in sorted(dist.items(), key=lambda x: -x[1]):
        label = _label(k, _BLEEDING_STRENGTH_LABELS, lang, k)
        bs_rows += f"<tr><td>{_h(label)}</td><td>{pct}%</td><td><div class='bar' style='width:{min(pct,100)}%'></div></td></tr>"
    bleeding_strength_html = f"<table class='dist-table'>{bs_rows}</table>" if bs_rows else T["no_data"]

    # Top symptoms
    top_syms = stats.get("top_symptoms", [])
    sym_rows = ""
    for s in top_syms:
        key = s.get("key", "")
        pct = s.get("pct", 0)
        label = _label(key, _SYMPTOM_KEY_LABELS, lang, key)
        sym_rows += f"<tr><td>{_h(label)}</td><td>{pct}%</td><td><div class='bar' style='width:{min(pct,100)}%'></div></td></tr>"
    top_sym_html = f"<table class='dist-table'>{sym_rows}</table>" if sym_rows else T["no_data"]

    # Pain trend
    trend = stats.get("pain_trend", [])
    trend_rows = ""
    for pt in trend:
        trend_rows += f"<tr><td>{_h(pt.get('cycle_start',''))}</td><td>{pt.get('pain_days',0)}</td></tr>"
    avg_pain = stats.get("avg_pain_days_per_cycle", 0)
    pain_trend_html = T["no_data"]
    if trend_rows:
        pain_trend_html = f"""
        <p>{_h(T['avg_pain_days'])}: <strong>{avg_pain}</strong></p>
        <table class='stats-table'>
          <tr><th>{_h(T['cycle_start'])}</th><th>{_h(T['pain_days'])}</th></tr>
          {trend_rows}
        </table>"""

    # Raw cycle data table
    normalized = normalize_history(history)
    today_iso = date.today().isoformat()
    cutoff_iso = (date.today() - timedelta(days=days_back)).isoformat()
    recent_history = sorted(
        (d for d in normalized if cutoff_iso <= d <= today_iso),
        reverse=True,
    )
    history_rows = "".join(
        f"<tr><td>{_h(d)}</td></tr>" for d in recent_history
    )
    raw_data_html = f"""
    <table class='stats-table'>
      <tr><th>{_h(T['date'])}</th></tr>
      {history_rows}
    </table>""" if history_rows else T["no_data"]

    return f"""<!DOCTYPE html>
<html lang="{_h(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{_h(T['title'])}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 20mm; }}
    h1 {{ font-size: 22px; color: #c0392b; margin-bottom: 4px; }}
    h2 {{ font-size: 15px; color: #555; border-bottom: 1px solid #ddd; margin: 18px 0 8px; padding-bottom: 4px; }}
    .subtitle {{ color: #888; font-size: 12px; margin-bottom: 20px; }}
    .meta {{ color: #666; font-size: 11px; margin-bottom: 24px; }}
    .meta span {{ margin-right: 20px; }}
    .section {{ margin-bottom: 24px; page-break-inside: avoid; }}
    table {{ border-collapse: collapse; width: 100%; }}
    td, th {{ border: 1px solid #ddd; padding: 6px 10px; text-align: left; }}
    th {{ background: #f5f5f5; font-weight: 600; }}
    .info-table td:first-child {{ font-weight: 600; width: 160px; background: #fafafa; }}
    .dist-table td:last-child {{ width: 120px; }}
    .bar {{ height: 12px; background: #c0392b; border-radius: 4px; min-width: 2px; }}
    footer {{ margin-top: 30px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }}
    @media print {{
      body {{ padding: 10mm; }}
      .no-print {{ display: none !important; }}
    }}
  </style>
</head>
<body>
  <h1>🩸 {_h(T['title'])}</h1>
  <div class="subtitle">{_h(T['subtitle'])}</div>
  <div class="meta">
    <span>{_h(T['report_date'])}: {_h(today_str)}</span>
    <span>{_h(T['profile'])}: {_h(profile)}</span>
    <span>{_h(T['period'])}</span>
    <span>{_h(T['cycles'])}</span>
  </div>

  {patient_section}

  <section class="section">
    <h2>{_h(T['cycle_length'])}</h2>
    {cycle_length_html}
  </section>

  <section class="section">
    <h2>{_h(T['bleeding_duration'])}</h2>
    {bleeding_dur_html}
  </section>

  <section class="section">
    <h2>{_h(T['bleeding_strength'])}</h2>
    {bleeding_strength_html}
  </section>

  <section class="section">
    <h2>{_h(T['top_symptoms'])}</h2>
    {top_sym_html}
  </section>

  <section class="section">
    <h2>{_h(T['pain_trend'])}</h2>
    {pain_trend_html}
  </section>

  <section class="section">
    <h2>{_h(T['cycle_data'])}</h2>
    {raw_data_html}
  </section>

  <footer>{_h(T['footer'])}</footer>
</body>
</html>"""
